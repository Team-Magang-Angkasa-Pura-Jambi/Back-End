import prisma from '../../configs/db.js';

import { GenericBaseService } from '../../utils/GenericBaseService.js';
import { type Prisma, type ReadingSession } from '../../generated/prisma/index.js';
import type {
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
  type CreateReadingSessionInternal,
  type GetHistoryResponse,
  type ReadingSessionWithDetails,
} from './types/index.js';
import {
  _buildOrderByClause,
  _buildWhereClause,
  _createReadingDetails,
  _findOrCreateSession,
  _updateDailySummary,
} from './helpers/reading-summarizer.js';
import { _classifyDailyUsage } from './helpers/forecast-calculator.js';

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

  public override async create(data: CreateReadingSessionInternal): Promise<ReadingSession> {
    const { meter_id, reading_date, details, user_id } = data;

    const meter = await _validateMeter(meter_id);

    const dateForDb = _normalizeDate(reading_date);

    await _validateDuplicateSession(meter_id, dateForDb);

    await _validateReadingsAgainstPrevious(meter, dateForDb, details);

    const newSession = await this._handleCrudOperation<ReadingSession>(() =>
      prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const { sessionId } = await _findOrCreateSession(tx, meter_id, dateForDb, user_id);
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
      }),
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
    data: UpdateReadingSessionBody,
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
          'Hanya data pembacaan terakhir yang dapat diubah. Untuk memperbaiki data lama, hapus entri hingga tanggal tersebut dan input ulang.',
        );
      }

      const meter = await _validateMeter(meter_id);
      await _validateReadingsAgainstPrevious(meter, reading_date, details ?? []);

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
        },
      );

      console.log(
        `[ReadingService] Data sesi ${sessionId} diperbarui. Memicu kalkulasi ulang untuk ${
          reading_date.toISOString().split('T')[0]
        }`,
      );

      return updatedSession;
    });
  }

  public async processAndSummarizeReading(
    meterId: number,
    date: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const db = tx ?? this._prisma;
    return this._handleCrudOperation(async () => {
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

      const summaries = await _updateDailySummary(db, meter, dateForDb);

      if (summaries) {
        for (const summary of summaries) {
          await _classifyDailyUsage(summary, meter);
          await _checkUsageAgainstTargetAndNotify(summary, meter);
        }
      }

      console.log(
        `[ReadingService] Memicu pembuatan/pembaruan logbook untuk tanggal ${dateForDb.toISOString()}`,
      );

      await dailyLogbookService.generateDailyLog(dateForDb);
    });
  }
  public override async delete(sessionId: number): Promise<ReadingSession> {
    return this._handleCrudOperation(() =>
      // PERBAIKAN: Gunakan this.prisma.$transaction, bukan model.delete
      prisma.$transaction(async (tx) => {
        // 1. Cari data yang akan dihapus
        const sessionToDelete = await tx.readingSession.findUniqueOrThrow({
          where: { session_id: sessionId },
        });

        // 2. Cek Session Terakhir untuk Meter tersebut
        const latestSession = await tx.readingSession.findFirst({
          where: { meter_id: sessionToDelete.meter_id },
          orderBy: { reading_date: 'desc' },
        });

        // 3. Validasi: Hanya boleh menghapus jika ini adalah data terakhir
        if (latestSession && latestSession.session_id !== sessionId) {
          throw new Error400(
            'Hanya data pembacaan terakhir yang dapat dihapus. Untuk memperbaiki data lama, hapus entri hingga tanggal tersebut dan input ulang.',
          );
        }

        const { meter_id, reading_date } = sessionToDelete;

        // 4. Hapus Data Terkait (DailySummary)
        await tx.dailySummary.deleteMany({
          where: {
            meter_id,
            summary_date: reading_date,
          },
        });

        // 5. Hapus Data Terkait (DailyLogbook)
        await tx.dailyLogbook.deleteMany({
          where: {
            meter_id,
            log_date: reading_date,
          },
        });

        // 6. Hapus ReadingSession
        const deletedSession = await tx.readingSession.delete({
          where: { session_id: sessionId },
        });

        return deletedSession;
      }),
    );
  }

  public override async findAll(
    args?: Prisma.ReadingSessionFindManyArgs & GetReadingSessionsQuery,
  ): Promise<ReadingSession[]> {
    const { meterId, userId, energyTypeName, date } = args ?? {};

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

  /**
   * Menemukan satu sesi pembacaan berdasarkan ID dengan relasi spesifik.
   */
  public override async findById(sessionId: number): Promise<ReadingSessionWithDetails> {
    const includeArgs = {
      meter: { include: { energy_type: true, category: true } },
      user: { select: { user_id: true, username: true } },
      details: { include: { reading_type: true } },
    };
    const result = await super.findById(sessionId, { include: includeArgs });
    return result as unknown as ReadingSessionWithDetails;
  }

  public async findLastReading(query: GetQueryLastReading) {
    const { meterId, readingTypeId } = query;

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
  }

  /**
   * Menemukan semua sesi, selalu menyertakan relasi dasar.
   */

  public async getHistory(query: GetReadingSessionsQuery): Promise<GetHistoryResponse> {
    const { energyTypeName, startDate, endDate, meterId, sortBy, sortOrder } = query;

    return this._handleCrudOperation(async () => {
      const whereClause = _buildWhereClause(
        query.date,
        energyTypeName,
        startDate,
        endDate,
        meterId,
      );

      const orderByClause = _buildOrderByClause(sortBy, sortOrder);

      const [readingSessions, paxData] = await Promise.all([
        prisma.readingSession.findMany({
          where: whereClause,
          orderBy: orderByClause,
          include: {
            meter: {
              include: { energy_type: true, daily_logbooks: true },
            },
            user: {
              select: { username: true },
            },
            details: {
              include: { reading_type: true },
              orderBy: { reading_type_id: 'asc' },
            },
          },
        }),
        prisma.paxData.findMany({
          where: {
            data_date: {
              gte: startDate ? new Date(startDate) : undefined,
              lte: endDate ? new Date(endDate) : undefined,
            },
          },
        }),
      ]);

      // 1. Fungsi Helper untuk normalisasi tanggal ke format YYYY-MM-DD secara LOKAL
      const toLocalDateString = (date: Date) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // 2. Buat Map dengan key lokal
      const paxDataMap = new Map<string, { total_pax: number; pax_id: number }>(
        paxData.map((p) => [
          toLocalDateString(p.data_date),
          { total_pax: p.total_pax, pax_id: p.pax_id },
        ]),
      );

      // 3. Gabungkan data menggunakan normalisasi yang SAMA
      const dataWithPax = readingSessions.map((session) => {
        const dateKey = toLocalDateString(session.reading_date); // Pastikan pakai toLocalDateString
        const paxInfo = paxDataMap.get(dateKey);

        return {
          ...session,
          paxData: {
            pax: paxInfo?.total_pax ?? null,
            pax_id: paxInfo?.pax_id ?? null,
          },
        };
      });

      return {
        data: dataWithPax,
        message: 'Successfully retrieved reading history.',
      };
    });
  }
}
