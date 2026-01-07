import prisma from '../../configs/db.js';

import { GenericBaseService } from '../../utils/GenericBaseService.js';
import {
  PaxData,
  Prisma,
  type ReadingSession,
} from '../../generated/prisma/index.js';
import type {
  CreateReadingSessionBody,
  GetQueryLastReading,
  GetReadingSessionsQuery,
  UpdateReadingSessionBody,
} from '../../types/metering/reading.types.js';
import { Error400 } from '../../utils/customError.js';
import { dailyLogbookService } from '../operations/dailyLogbook.service.js';
import { AnalysisService } from '../reports/analysis.service.js';
import {
  _checkAndResolveMissingDataAlert,
  _checkUsageAgainstTargetAndNotify,
  _normalizeDate,
  _validateDuplicateSession,
  _validateMeter,
  _validateReadingsAgainstPrevious,
} from './helpers/reading-validator.js';
import {
  CreateReadingSessionInternal,
  GetHistoryResponse,
  ReadingHistoryItem,
  ReadingSessionWithDetails,
  ReadingSessionWithRelations,
} from './types/index.js';
import {
  _buildOrderByClause,
  _buildWhereClause,
  _createReadingDetails,
  _findOrCreateSession,
  _updateDailySummary,
} from './helpers/reading-summarizer.js';
import { _classifyDailyUsage } from './helpers/forecast-calculator.js';
import { CustomErrorMessages } from '../../utils/baseService.js';

export class ReadingService extends GenericBaseService<
  typeof prisma.readingSession,
  ReadingSession,
  CreateReadingSessionInternal,
  UpdateReadingSessionBody,
  Prisma.ReadingSessionFindManyArgs,
  Prisma.ReadingSessionFindUniqueArgs,
  Prisma.ReadingSessionCreateArgs,
  Prisma.ReadingSessionUpdateArgs,
  Prisma.ReadingSessionDeleteArgs
> {
  constructor() {
    super(prisma, prisma.readingSession, 'session_id');
  }

  public override async create(
    data: CreateReadingSessionInternal
  ): Promise<ReadingSession> {
    const { meter_id, reading_date, details, user_id } = data;

    const meter = await _validateMeter(meter_id);

    const dateForDb = _normalizeDate(reading_date);

    await _validateDuplicateSession(meter_id, dateForDb);

    await _validateReadingsAgainstPrevious(meter, dateForDb, details);

    const newSession = await this._handleCrudOperation<ReadingSession>(() =>
      prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const { sessionId } = await _findOrCreateSession(
          tx,
          meter_id,
          dateForDb,
          user_id
        );
        await _createReadingDetails(tx, sessionId, details);

        await _updateDailySummary(tx, meter, dateForDb);

        return tx.readingSession.findUniqueOrThrow({
          where: { session_id: sessionId },
          include: {
            details: { include: { reading_type: true } },
            meter: { select: { meter_code: true } },
            user: { select: { username: true } },
          },
        });
      })
    );

    await _checkAndResolveMissingDataAlert(meter_id, dateForDb);

    const analysisService = new AnalysisService();

    analysisService.runPredictionForDate(dateForDb);

    return newSession;
  }

  /**
   * Memperbarui data pembacaan meter yang sudah ada.
   * Metode ini akan memvalidasi data baru, memperbarui detail dalam transaksi,
   * dan memicu kalkulasi ulang untuk tanggal yang bersangkutan dan hari berikutnya.
   * @param sessionId - ID dari ReadingSession yang akan diperbarui.
   * @param data - Data baru yang berisi detail pembacaan.
   */
  public override async update(
    sessionId: number,
    data: UpdateReadingSessionBody
  ): Promise<ReadingSession> {
    const { details } = data;

    return this._handleCrudOperation(async () => {
      const currentSession = await this._model.findUniqueOrThrow({
        where: { session_id: sessionId },
      });
      const { meter_id, reading_date } = currentSession;

      const latestSession = await this._prisma.readingSession.findFirst({
        where: { meter_id },
        orderBy: { reading_date: 'desc' },
      });

      if (latestSession && latestSession.session_id !== sessionId) {
        throw new Error400(
          'Hanya data pembacaan terakhir yang dapat diubah. Untuk memperbaiki data lama, hapus entri hingga tanggal tersebut dan input ulang.'
        );
      }

      const meter = await _validateMeter(meter_id);
      await _validateReadingsAgainstPrevious(
        meter,
        reading_date,
        details ?? []
      );

      const updatedSession = await this._prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          await tx.readingDetail.deleteMany({
            where: { session_id: sessionId },
          });

          await _createReadingDetails(tx, sessionId, details ?? []);
          await this.processAndSummarizeReading(meter_id, reading_date, tx);
          return tx.readingSession.findUniqueOrThrow({
            where: { session_id: sessionId },
            include: {
              details: { include: { reading_type: true } },
              meter: { select: { meter_code: true } },
              user: { select: { username: true } },
            },
          });
        }
      );

      console.log(
        `[ReadingService] Data sesi ${sessionId} diperbarui. Memicu kalkulasi ulang untuk ${
          reading_date.toISOString().split('T')[0]
        }`
      );

      return updatedSession;
    });
  }

  public async processAndSummarizeReading(
    meterId: number,
    date: Date,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const db = tx || this._prisma;
    return this._handleCrudOperation(async () => {
      // Gunakan 'tx' untuk query agar tetap dalam transaksi yang sama
      const meter = await db.meter.findUniqueOrThrow({
        where: { meter_id: meterId },
        include: {
          energy_type: true,
          category: true,
          tariff_group: {
            include: {
              price_schemes: {
                include: {
                  rates: { include: { reading_type: true } },
                  taxes: { include: { tax: true } },
                },
              },
            },
          },
        },
      });

      const dateForDb = _normalizeDate(date);

      // PERBAIKAN: _updateDailySummary sekarang menjadi pusat kalkulasi dan penyimpanan.
      const summaries = await _updateDailySummary(db, meter, dateForDb);

      if (summaries) {
        for (const summary of summaries) {
          // Panggil proses sekunder setelah summary utama selesai.
          await _classifyDailyUsage(summary, meter);
          await _checkUsageAgainstTargetAndNotify(summary, meter);
        }
      }

      console.log(
        `[ReadingService] Memicu pembuatan/pembaruan logbook untuk tanggal ${dateForDb.toISOString()}`
      );
      // PERBAIKAN: Panggil generateDailyLog di luar transaksi utama
      // untuk menghindari error jika transaksi sudah selesai.
      await dailyLogbookService.generateDailyLog(dateForDb);
    });
  }
  public override async delete(sessionId: number): Promise<ReadingSession> {
    return this._handleCrudOperation(() =>
      this._prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const sessionToDelete = await tx.readingSession.findUniqueOrThrow({
          where: { session_id: sessionId },
          select: { meter_id: true, reading_date: true },
        });

        // BARU: Validasi bahwa hanya data terakhir yang bisa dihapus.
        const latestSession = await tx.readingSession.findFirst({
          where: { meter_id: sessionToDelete.meter_id },
          orderBy: { reading_date: 'desc' },
        });

        // Jika ada sesi terakhir dan ID-nya tidak sama dengan sesi yang akan dihapus,
        // berarti pengguna mencoba menghapus data di tengah.
        if (latestSession && latestSession.session_id !== sessionId) {
          throw new Error400(
            'Hanya data pembacaan terakhir yang dapat dihapus. Untuk memperbaiki data lama, hapus entri hingga tanggal tersebut dan input ulang.'
          );
        }

        const { meter_id, reading_date } = sessionToDelete;

        await tx.dailySummary.deleteMany({
          where: {
            meter_id,
            summary_date: reading_date,
          },
        });

        await tx.dailyLogbook.deleteMany({
          where: {
            meter_id,
            log_date: reading_date,
          },
        });

        const deletedSession = await tx.readingSession.delete({
          where: { session_id: sessionId },
        });

        return deletedSession;
      })
    );
  }

  public override async findAll(
    args?: Prisma.ReadingSessionFindManyArgs & GetReadingSessionsQuery,
    customMessages?: CustomErrorMessages
  ): Promise<ReadingSession[]> {
    const { meterId, userId, energyTypeName, date, ...rest } = args || {};

    const where: Prisma.ReadingSessionWhereInput = {};

    if (energyTypeName) {
      where.meter = { energy_type: { type_name: energyTypeName } };
    }

    if (meterId) {
      where.meter_id = meterId;
    }

    if (userId) {
      where.user_id = userId;
    }

    if (date) {
      const readingDate = new Date(date);
      readingDate.setHours(0, 0, 0, 0);
      where.reading_date = readingDate;
    }

    return this._handleCrudOperation(() => this._model.findMany({ where }));
  }

  // public override async findAll(
  //   args: Prisma.ReadingTypeFindManyArgs
  // ): Promise<ReadingSessionWithDetails[]> {
  //   const { energyTypeName, date, meterId, userId } = args;
  //   const whereClause: Prisma.ReadingSessionWhereInput = {};

  //   if (energyTypeName)
  //     whereClause.meter = { energy_type: { type_name: energyTypeName } };
  //   if (date) {
  //     const readingDate = new Date(date);
  //     readingDate.setUTCHours(0, 0, 0, 0);
  //     whereClause.reading_date = readingDate;
  //   }
  //   if (meterId) whereClause.meter_id = meterId;
  //   if (userId) whereClause.user_id = userId;

  //   return this._handleCrudOperation(() =>
  //     this._model.findMany({
  //       where: whereClause,
  //       include: {
  //         meter: { include: { energy_type: true, category: true } },
  //         user: { select: { user_id: true, username: true } },
  //         details: { include: { reading_type: true } },
  //       },
  //       orderBy: { created_at: 'desc' },
  //     })
  //   );
  // }

  /**
   * Menemukan satu sesi pembacaan berdasarkan ID dengan relasi spesifik.
   */
  public override async findById(
    sessionId: number
  ): Promise<ReadingSessionWithDetails> {
    const includeArgs = {
      meter: { include: { energy_type: true, category: true } },
      user: { select: { user_id: true, username: true } },
      details: { include: { reading_type: true } },
    };
    const result = await super.findById(sessionId, { include: includeArgs });
    return result as unknown as ReadingSessionWithDetails;
  }

  public async findLastReading(query: GetQueryLastReading) {
    const { meterId, readingTypeId, readingDate } = query;
    const dateForDb = _normalizeDate(readingDate);

    // MODIFIKASI: Hitung tanggal H-1 secara eksplisit
    // const previousDate = new Date(dateForDb);
    // previousDate.setUTCDate(previousDate.getUTCDate() - 1);

    const energyType = await prisma.meter.findFirst({
      where: { meter_id: meterId },
      select: { energy_type: { select: { type_name: true } } },
    });

    // if (energyType?.energy_type.type_name === 'Fuel') {
    //   const lastReading = await prisma.readingDetail.findFirst({
    //     where: {
    //       session: {
    //         meter_id: meterId,
    //       },
    //       reading_type_id: readingTypeId,
    //     },
    //     orderBy: {
    //       session: {
    //         reading_date: 'desc',
    //       },
    //     },
    //     include: {
    //       session: {
    //         select: { reading_date: true },
    //       },
    //     },
    //   });

    //   if (lastReading?.value) {
    //     // KASUS: Data H-1 Ditemukan (Aman)
    //     return {
    //       meter_id: meterId,
    //       last_reading_date: lastReading?.session?.reading_date,
    //       value: lastReading?.value,
    //       message: `Data Terakhir adalah ${lastReading?.value} cm`,
    //     };
    //   }
    // }

    const lastReading = await prisma.readingDetail.findFirst({
      where: {
        reading_type_id: readingTypeId,
        session: { meter_id: meterId },
      },
      orderBy: { session: { reading_date: 'desc' } },
      select: {
        value: true,
        reading_type_id: true,
        session: {
          select: {
            reading_date: true,
          },
        },
      },
    });

    return lastReading;

    // if (lastReading?.value) {
    //   // KASUS: Data H-1 Ditemukan (Aman)
    //   return {
    //     meter_id: meterId,
    //     last_reading_date: lastReading?.session?.reading_date,
    //     value: lastReading?.value,
    //     is_data_missing: false, // Data TIDAK hilang
    //     missing_date: null,
    //     message: 'Data hari sebelumnya lengkap.',
    //   };
    // } else {
    //   // KASUS: Data H-1 Tidak Ada (Bolong)
    //   return {
    //     meter_id: meterId,
    //     last_reading_date: null,
    //     value: null,
    //     is_data_missing: true, // Data HILANG
    //     missing_date: previousDate,
    //     // Format tanggal biar enak dibaca user
    //     message: `Data Tanggal ${previousDate.toISOString().split('T')[0]} Belum Diisi. Harap input berurutan!`,
    //   };
    // }
  }

  /**
   * Menemukan semua sesi, selalu menyertakan relasi dasar.
   */
  // public override async findAll(
  //   args?: Prisma.ReadingSessionFindManyArgs
  // ): Promise<ReadingSessionWithDetails[]> {
  //   const includeArgs = {
  //     meter: { include: { energy_type: true } },
  //     user: { select: { user_id: true, username: true } },
  //     details: { include: { reading_type: true } },
  //   };
  //   const findArgs = { ...args, include: { ...args?.include, ...includeArgs } };

  //   const result = this._handleCrudOperation(() =>
  //     this._model.findMany(findArgs)
  //   );

  //   return result as unknown as ReadingSessionWithDetails[];
  // }

  public async getHistory(
    query: GetReadingSessionsQuery
  ): Promise<GetHistoryResponse> {
    const { energyTypeName, startDate, endDate, meterId, sortBy, sortOrder } =
      query;

    return this._handleCrudOperation(async () => {
      const whereClause = _buildWhereClause(
        query.date,
        energyTypeName,
        startDate,
        endDate,
        meterId
      );

      const orderByClause = _buildOrderByClause(sortBy, sortOrder);

      // Gunakan Promise.all untuk mengambil data paralel
      const [readingSessions, paxData] = await Promise.all([
        this._prisma.readingSession.findMany({
          where: whereClause,
          orderBy: orderByClause,
          select: {
            session_id: true,
            reading_date: true,

            meter: {
              select: {
                meter_id: true,
                meter_code: true,
              },
            },

            user: {
              select: {
                username: true,
              },
            },

            details: {
              select: {
                detail_id: true,
                value: true,
                reading_type: {
                  select: { type_name: true, reading_type_id: true },
                },
              },
              orderBy: { reading_type_id: 'asc' },
            },
          },
        }),
        this._prisma.paxData.findMany({
          where: {
            data_date: whereClause.reading_date,
          },
        }),
      ]);

      // Map Pax Data
      const paxDataMap = new Map<string, { total_pax: number; pax_id: number }>(
        paxData.map((p: PaxData) => [
          p.data_date.toISOString().split('T')[0],
          { total_pax: p.total_pax, pax_id: p.pax_id },
        ])
      );

      // Merge Data
      // Kita perlu casting 'as ReadingHistoryItem[]' karena TypeScript
      // tidak otomatis tahu kalau kita sudah menambah properti 'pax' & 'pax_id'
      const dataWithPax = readingSessions.map(
        (session: ReadingSessionWithRelations) => {
          const dateString = session.reading_date.toISOString().split('T')[0];
          const paxInfo = paxDataMap.get(dateString);

          return {
            ...session,
            paxData: {
              pax: paxInfo?.total_pax ?? null,
              pax_id: paxInfo?.pax_id ?? null,
            },
          };
        }
      ) as ReadingHistoryItem[];

      return {
        data: dataWithPax,
        message: 'Successfully retrieved reading history.',
      };
    });
  }
}

// export const readingService = new ReadingService();
