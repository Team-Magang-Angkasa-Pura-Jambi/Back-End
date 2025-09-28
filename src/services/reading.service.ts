import prisma from '../configs/db.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';
import {
  type ReadingSession,
  Prisma,
  type ReadingDetail,
  type ReadingType,
  type Meter,
} from '../generated/prisma/index.js';
import type {
  CreateReadingSessionBody,
  GetQueryLastReading,
  GetReadingSessionsQuery,
  UpdateReadingSessionBody,
} from '../types/reading.types.js';
import {
  Error400,
  Error404,
  Error409,
  Error500,
} from '../utils/customError.js';

// --- Tipe Data Lokal untuk Kejelasan ---
type CreateReadingSessionInternal = CreateReadingSessionBody & {
  user_id: number;
  reading_date: Date;
};

type CreatedReadingSession = ReadingSession & {
  details: (ReadingDetail & {
    reading_type: ReadingType;
  })[];
};

type MeterWithEnergyType = Meter & {
  energy_type: ReadingType['energy_type_id'];
};

type ReadingSessionWithDetails = Prisma.ReadingSessionGetPayload<{
  include: {
    meter: { include: { energy_type: true } };
    user: { select: { user_id: true; username: true } };
    details: { include: { reading_type: true } };
  };
}>;

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

  /**
   * Metode private untuk mengkapsulasi logika pembuatan/pembaruan DailySummary.
   */
  private async _updateDailySummary(
    tx: Prisma.TransactionClient,
    meter: Prisma.MeterGetPayload<{ include: { energy_type: true } }>,
    dateForDb: Date
  ) {
    const currentSession = await tx.readingSession.findUnique({
      where: {
        unique_meter_reading_per_day: {
          reading_date: dateForDb,
          meter_id: meter.meter_id,
        },
      },
      include: { details: true },
    });
    if (!currentSession) return;

    const previousSession = await tx.readingSession.findFirst({
      where: { meter_id: meter.meter_id, reading_date: { lt: dateForDb } },
      orderBy: { reading_date: 'desc' },
      include: { details: true },
    });

    let dailyConsumption = new Prisma.Decimal(0);
    let dailyCost = new Prisma.Decimal(0);
    let summaryDetailData: Omit<Prisma.SummaryDetailCreateInput, 'summary'>;
    let todayValue = new Prisma.Decimal(0);
    let yesterdayValue = new Prisma.Decimal(0);

    if (meter.energy_type.type_name === 'Electricity') {
      const HARGA_WBP = new Prisma.Decimal(1700);
      const HARGA_LWBP = new Prisma.Decimal(1450);

      const readingTypes = await tx.readingType.findMany({
        where: { energy_type_id: meter.energy_type_id },
      });
      const wbpType = readingTypes.find((rt) => rt.type_name === 'WBP');
      const lwbpType = readingTypes.find((rt) => rt.type_name === 'LWBP');
      const kwhTotalType = readingTypes.find(
        (rt) => rt.type_name === 'kWh_Total'
      );

      const getDetailValue = (
        session: typeof currentSession,
        typeId?: number
      ) =>
        session?.details.find((d) => d.reading_type_id === typeId)?.value ??
        new Prisma.Decimal(0);

      const wbpConsumption = getDetailValue(
        currentSession,
        wbpType?.reading_type_id
      ).minus(getDetailValue(previousSession, wbpType?.reading_type_id));
      const lwbpConsumption = getDetailValue(
        currentSession,
        lwbpType?.reading_type_id
      ).minus(getDetailValue(previousSession, lwbpType?.reading_type_id));

      dailyConsumption = wbpConsumption.plus(lwbpConsumption);

      dailyCost = wbpConsumption
        .times(2) // kali 2 karna golongan 2
        .times(HARGA_WBP)
        .plus(lwbpConsumption.times(2).times(HARGA_LWBP));

      todayValue = getDetailValue(
        currentSession,
        kwhTotalType?.reading_type_id
      );
      yesterdayValue = getDetailValue(
        previousSession,
        kwhTotalType?.reading_type_id
      );

      summaryDetailData = {
        energy_type_id: meter.energy_type_id,
        metric_name: `Pemakaian Harian (${meter.energy_type.unit_of_measurement})`,
        current_reading: todayValue,
        previous_reading: yesterdayValue,
        consumption_value: dailyConsumption,
        consumption_cost: dailyCost,
        wbp_value: wbpConsumption,
        lwbp_value: lwbpConsumption,
      };
    } else {
      const mainReadingTypeNameMap: { [key: string]: string } = {
        Water: 'm3_Total',
        Fuel: 'Liter_Total',
      };
      const mainReadingTypeName =
        mainReadingTypeNameMap[meter.energy_type.type_name];
      if (!mainReadingTypeName) return;

      const mainReadingType = await tx.readingType.findUnique({
        where: { type_name: mainReadingTypeName },
      });
      if (!mainReadingType) return;

      todayValue =
        currentSession.details.find(
          (d) => d.reading_type_id === mainReadingType.reading_type_id
        )?.value ?? new Prisma.Decimal(0);
      yesterdayValue =
        previousSession?.details.find(
          (d) => d.reading_type_id === mainReadingType.reading_type_id
        )?.value ?? new Prisma.Decimal(0);

      dailyConsumption = todayValue.minus(yesterdayValue);
      dailyCost = dailyConsumption.times(1500);
      summaryDetailData = {
        energy_type_id: meter.energy_type_id,
        metric_name: `Pemakaian Harian (${meter.energy_type.unit_of_measurement})`,
        current_reading: todayValue,
        previous_reading: yesterdayValue,
        consumption_value: dailyConsumption,
        consumption_cost: dailyCost,
      };
    }

    const dailySummary = await tx.dailySummary.upsert({
      where: {
        summary_date_meter_id: {
          summary_date: dateForDb,
          meter_id: meter.meter_id,
        },
      },
      update: { total_cost: dailyCost },
      create: {
        summary_date: dateForDb,
        meter_id: meter.meter_id,
        total_cost: dailyCost,
      },
    });

    await tx.summaryDetail.deleteMany({
      where: { summary_id: dailySummary.summary_id },
    });
    await tx.summaryDetail.create({
      data: {
        ...summaryDetailData,
        summary_id: dailySummary.summary_id,
      },
    });
  }

  public override async create(
    data: CreateReadingSessionInternal
  ): Promise<CreatedReadingSession> {
    const { meter_id, reading_date, details, user_id } = data;

    const meter = await this._validateMeter(meter_id);
    const dateForDb = this._normalizeDate(reading_date);

    return this._handleCrudOperation(() =>
      prisma.$transaction(async (tx) => {
        await this._validateIncomingReadings(tx, meter_id, dateForDb, details);

        // LANGKAH 2: Cari atau buat sesi pembacaan
        const { sessionId, isNew } = await this._findOrCreateSession(
          tx,
          meter_id,
          dateForDb,
          user_id
        );

        // LANGKAH 3: Tambahkan detail ke sesi
        if (isNew) {
          await tx.readingDetail.createMany({
            data: details.map((d) => ({ ...d, session_id: sessionId })),
          });
        } else {
          await this._addDetailsToExistingSession(tx, sessionId, details);
        }

        // LANGKAH 4: Kalkulasi ulang kWh_Total jika ini listrik
        if (meter.energy_type.type_name === 'Electricity') {
          await this._recalculateKwhTotal(tx, sessionId);
        }

        // LANGKAH 5: Perbarui summary harian
        await this._updateDailySummary(tx, meter, dateForDb);

        // LANGKAH 6: Kembalikan data sesi terbaru
        return tx.readingSession.findUniqueOrThrow({
          where: { session_id: sessionId },
          include: { details: { include: { reading_type: true } } },
        });
      })
    );
  }

  /**
   * Menemukan sesi pembacaan terakhir untuk tipe tertentu pada meteran tertentu.
   */
  public async findLastReading(query: GetQueryLastReading) {
    const { meterId, readingTypeId } = query;
    return this._handleCrudOperation(() =>
      prisma.readingDetail.findFirst({
        where: {
          reading_type_id: readingTypeId,
          session: { meter_id: meterId },
        },
        orderBy: { session: { reading_date: 'desc' } },
        select: {
          value: true,
          reading_type_id: true,
        },
      })
    );
  }

  /**
   * Menemukan semua sesi pembacaan dengan filter dinamis dan relasi yang kompleks.
   */
  public async findAllWithFilters(
    query: GetReadingSessionsQuery
  ): Promise<ReadingSessionWithDetails[]> {
    const { energyTypeName, date, meterId, userId } = query;
    const whereClause: Prisma.ReadingSessionWhereInput = {};

    if (energyTypeName)
      whereClause.meter = { energy_type: { type_name: energyTypeName } };
    if (date) {
      const readingDate = new Date(date);
      readingDate.setUTCHours(0, 0, 0, 0);
      whereClause.reading_date = readingDate;
    }
    if (meterId) whereClause.meter_id = meterId;
    if (userId) whereClause.user_id = userId;

    return this._handleCrudOperation(() =>
      this._model.findMany({
        where: whereClause,
        include: {
          meter: { include: { energy_type: true } },
          user: { select: { user_id: true, username: true } },
          details: { include: { reading_type: true } },
          correction_for: { include: { details: true } },
        },
        orderBy: { created_at: 'desc' },
      })
    );
  }

  /**
   * Menemukan satu sesi pembacaan berdasarkan ID dengan relasi spesifik.
   */
  public override async findById(
    sessionId: number
  ): Promise<ReadingSessionWithDetails> {
    const includeArgs = {
      meter: { include: { energy_type: true } },
      user: { select: { user_id: true, username: true } },
      details: { include: { reading_type: true } },
    };
    return super.findById(sessionId, { include: includeArgs });
  }

  /**
   * Menemukan semua sesi, selalu menyertakan relasi dasar.
   */
  public override async findAll(
    args?: Prisma.ReadingSessionFindManyArgs
  ): Promise<ReadingSessionWithDetails[]> {
    const includeArgs = {
      meter: { include: { energy_type: true } },
      user: { select: { user_id: true, username: true } },
      details: { include: { reading_type: true } },
    };
    const findArgs = { ...args, include: { ...args?.include, ...includeArgs } };
    return super.findAll(findArgs);
  }

  /**
   * Membuat data koreksi untuk sesi yang sudah ada.
   */
  public async createCorrection(
    originalSessionId: number,
    data: CreateReadingSessionInternal
  ) {
    await this.findById(originalSessionId);
    const { meter_id, user_id, reading_date, details } = data;
    const dateForDb = this._normalizeDate(reading_date);

    return this._handleCrudOperation(() =>
      prisma.$transaction(async (tx) => {
        const newCorrection = await tx.readingSession.create({
          data: {
            meter_id,
            user_id,
            reading_date: dateForDb,
            is_correction_for_id: originalSessionId,
          },
        });
        const detailData = details.map((d) => ({
          ...d,
          session_id: newCorrection.session_id,
        }));
        await tx.readingDetail.createMany({ data: detailData });
        // (Anda bisa memanggil _updateDailySummary di sini juga jika koreksi harus memperbarui summary)
        return tx.readingSession.findUniqueOrThrow({
          where: { session_id: newCorrection.session_id },
          include: { details: true, correction_for: true },
        });
      })
    );
  }

  // =============================================
  // METODE HELPER PRIVAT
  // =============================================

  private async _validateMeter(meter_id: number): Promise<MeterWithEnergyType> {
    const meter = await prisma.meter.findUnique({
      where: { meter_id },
      include: { energy_type: true },
    });
    if (!meter)
      throw new Error404(`Meteran dengan ID ${meter_id} tidak ditemukan.`);
    if (meter.status === 'DELETED')
      throw new Error400(`Meteran dengan ID ${meter_id} sudah dihapus.`);
    return meter;
  }

  private _normalizeDate(date: Date): Date {
    const newDate = new Date(date);
    newDate.setUTCHours(0, 0, 0, 0);
    return newDate;
  }

  private async _validateIncomingReadings(
    tx: Prisma.TransactionClient,
    meterId: number,
    dateForDb: Date,
    details: CreateReadingSessionInternal['details']
  ) {
    await Promise.all(
      details.map(async (detail) => {
        const lastDetail = await tx.readingDetail.findFirst({
          where: {
            reading_type_id: detail.reading_type_id,
            session: { meter_id: meterId, reading_date: { lt: dateForDb } },
          },
          orderBy: { session: { reading_date: 'desc' } },
        });
        const previousValue = lastDetail?.value?.toNumber() ?? 0;
        if (detail.value < previousValue) {
          const type = await tx.readingType.findUnique({
            where: { reading_type_id: detail.reading_type_id },
          });
          throw new Error400(
            `Nilai untuk '${type?.type_name}' (${detail.value}) tidak boleh lebih kecil dari sebelumnya (${previousValue}).`
          );
        }
      })
    );
  }

  private async _findOrCreateSession(
    tx: Prisma.TransactionClient,
    meter_id: number,
    reading_date: Date,
    user_id: number
  ) {
    const existingSession = await tx.readingSession.findUnique({
      where: { unique_meter_reading_per_day: { reading_date, meter_id } },
    });
    if (existingSession)
      return { sessionId: existingSession.session_id, isNew: false };

    const newSession = await tx.readingSession.create({
      data: { meter_id, user_id, reading_date },
    });
    return { sessionId: newSession.session_id, isNew: true };
  }

  private async _addDetailsToExistingSession(
    tx: Prisma.TransactionClient,
    sessionId: number,
    details: CreateReadingSessionInternal['details']
  ) {
    const existingDetails = await tx.readingDetail.findMany({
      where: { session_id: sessionId },
    });
    for (const detail of details) {
      if (
        existingDetails.some(
          (d) => d.reading_type_id === detail.reading_type_id
        )
      ) {
        const typeName = await tx.readingType.findUnique({
          where: { reading_type_id: detail.reading_type_id },
        });
        throw new Error409(
          `Data untuk tipe '${typeName?.type_name}' sudah ada di sesi ini.`
        );
      }
    }
    await tx.readingDetail.createMany({
      data: details.map((d) => ({ ...d, session_id: sessionId })),
    });
  }

  private async _recalculateKwhTotal(
    tx: Prisma.TransactionClient,
    sessionId: number
  ) {
    const allDetails = await tx.readingDetail.findMany({
      where: { session_id: sessionId },
    });
    const readingTypes = await tx.readingType.findMany({
      where: { energy_type: { type_name: 'Electricity' } },
    });
    const wbpType = readingTypes.find((rt) => rt.type_name === 'WBP');
    const lwbpType = readingTypes.find((rt) => rt.type_name === 'LWBP');
    const kwhTotalType = readingTypes.find(
      (rt) => rt.type_name === 'kWh_Total'
    );
    if (!wbpType || !lwbpType || !kwhTotalType) return;

    const wbpDetail = allDetails.find(
      (d) => d.reading_type_id === wbpType.reading_type_id
    );
    const lwbpDetail = allDetails.find(
      (d) => d.reading_type_id === lwbpType.reading_type_id
    );

    if (wbpDetail && lwbpDetail) {
      const newKwhTotal = new Prisma.Decimal(wbpDetail.value).plus(
        lwbpDetail.value
      );
      const kwhTotalDetail = allDetails.find(
        (d) => d.reading_type_id === kwhTotalType.reading_type_id
      );
      if (kwhTotalDetail) {
        await tx.readingDetail.update({
          where: { detail_id: kwhTotalDetail.detail_id },
          data: { value: newKwhTotal },
        });
      } else {
        await tx.readingDetail.create({
          data: {
            session_id: sessionId,
            reading_type_id: kwhTotalType.reading_type_id,
            value: newKwhTotal,
          },
        });
      }
    }
  }
}
