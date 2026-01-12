import prisma from '../../../configs/db.js';
import { InsightSeverity, Prisma, RoleName } from '../../../generated/prisma/index.js';
import { type MeterWithRelations } from '../../../types/metering/meter.types-temp.js';
import { Error400, Error404, Error409 } from '../../../utils/customError.js';
import { type CreateReadingSessionInternal } from '../types/index.js';

export const _validateReadingsAgainstPrevious = async (
  meter: MeterWithRelations,
  dateForDb: Date,
  details: CreateReadingSessionInternal['details'],
) => {
  if (meter.energy_type.type_name === 'Fuel') {
    if (meter.tank_height_cm) {
      const tankHeight = new Prisma.Decimal(meter.tank_height_cm);
      for (const detail of details) {
        const currentValue = new Prisma.Decimal(detail.value);
        if (currentValue.greaterThan(tankHeight)) {
          throw new Error400(
            `Ketinggian BBM yang diinput (${currentValue.toString()} cm) tidak boleh melebihi kapasitas maksimal tangki (${tankHeight.toString()} cm).`,
          );
        }
      }
    }

    return;
  }

  const previousDate = new Date(dateForDb);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);

  const previousSession = await prisma.readingSession.findUnique({
    where: {
      unique_meter_reading_per_day: {
        meter_id: meter.meter_id,
        reading_date: previousDate,
      },
    },
    include: { details: true },
  });

  if (!previousSession) {
    const anyPreviousEntry = await prisma.readingSession.findFirst({
      where: { meter_id: meter.meter_id, reading_date: { lt: dateForDb } },
    });

    if (anyPreviousEntry) {
      throw new Error400(
        `Data untuk tanggal ${
          previousDate.toISOString().split('T')[0]
        } belum diinput. Silakan input data hari sebelumnya terlebih dahulu.`,
      );
    }

    return;
  }

  for (const detail of details) {
    const prevDetail = previousSession.details.find(
      (d) => d.reading_type_id === detail.reading_type_id,
    );
    if (!prevDetail) continue;

    const currentValue = new Prisma.Decimal(detail.value);

    // BARU: Validasi bahwa nilai input tidak melebihi rollover_limit jika ada.
    if (meter.rollover_limit) {
      const rolloverLimit = new Prisma.Decimal(meter.rollover_limit);
      if (currentValue.greaterThan(rolloverLimit)) {
        throw new Error400(
          `Nilai input (${currentValue.toString()}) tidak boleh lebih besar dari batas reset meter (${rolloverLimit.toString()}).`,
        );
      }
    }
  }
};

export const _validateDuplicateSession = async (meter_id: number, dateForDb: Date) => {
  const existingSession = await prisma.readingSession.findUnique({
    where: {
      unique_meter_reading_per_day: { meter_id, reading_date: dateForDb },
    },
    select: {
      details: {
        select: {
          reading_type: { select: { type_name: true } }, // Pastikan ambil field 'name'
        },
      },
    },
  });

  if (existingSession) {
    // 1. Ambil list tipe yang sudah ada (misal: "Kwh Import, Kvarh")
    const existingTypes = existingSession.details.map((d) => d.reading_type.type_name).join(', ');

    // 2. Format tanggal agar lebih enak dibaca manusia (Opsional, atau tetap pakai ISO)
    const formattedDate = dateForDb.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // 3. Throw Error dengan Diksi Modern
    throw new Error409(
      `Entri harian untuk tanggal ${formattedDate} sudah terdaftar. (Data yang sudah ada: ${existingTypes})`,
    );
  }
};

export const _validateMeter = async (meter_id: number): Promise<MeterWithRelations> => {
  const meter = await prisma.meter.findUnique({
    where: { meter_id },
    include: {
      energy_type: true,
      category: true,
      tariff_group: {
        include: {
          price_schemes: { include: { rates: true, taxes: true } },
        },
      },
    },
  });
  if (!meter) throw new Error404(`Meteran dengan ID ${meter_id} tidak ditemukan.`);
  if (meter.status === 'Deleted')
    throw new Error400(`Meteran dengan ID ${meter_id} sudah dihapus.`);
  return meter;
};

export const _checkUsageAgainstTargetAndNotify = async (
  summary: Prisma.DailySummaryGetPayload<object>,
  meter: MeterWithRelations,
) => {
  const target = await prisma.efficiencyTarget.findFirst({
    where: {
      meter_id: meter.meter_id,
      period_start: { lte: summary.summary_date },
      period_end: { gte: summary.summary_date },
    },
  });

  if (!target || target.target_value.isZero()) {
    return;
  }

  const summaryDetails = await prisma.summaryDetail.findMany({
    where: { summary_id: summary.summary_id },
  });

  if (summaryDetails.length === 0) {
    return;
  }

  let totalConsumption: Prisma.Decimal;
  if (meter.energy_type.type_name === 'Electricity') {
    const wbp =
      summaryDetails.find((d) => d.metric_name === 'Pemakaian WBP')?.consumption_value ??
      new Prisma.Decimal(0);
    const lwbp =
      summaryDetails.find((d) => d.metric_name === 'Pemakaian LWBP')?.consumption_value ??
      new Prisma.Decimal(0);
    totalConsumption = wbp.plus(lwbp);
  } else {
    totalConsumption = summaryDetails[0].consumption_value;
  }

  if (totalConsumption.greaterThan(target.target_value)) {
    const excess = totalConsumption.minus(target.target_value);
    const percentage = excess.div(target.target_value).times(100).toFixed(2);

    const admins = await prisma.user.findMany({
      where: {
        role: { role_name: { in: [RoleName.Admin, RoleName.SuperAdmin] } },
      },
      select: { user_id: true },
    });

    const message = `Pemakaian harian untuk meteran ${meter.meter_code} melebihi target sebesar ${percentage}%.`;
    const title = 'Peringatan: Target Efisiensi Terlampaui';

    await prisma.analyticsInsight.create({
      data: {
        title,
        description: message,
        severity: InsightSeverity.MEDIUM,
        insight_date: summary.summary_date,
        meter_id: meter.meter_id,
        source_data_ref: {
          summaryId: summary.summary_id,
          targetId: target.target_id,
        },
      },
    });
  }
};

export const _checkAndResolveMissingDataAlert = async (
  meterId: number,
  dateForDb: Date,
): Promise<void> => {
  const alertTitle = 'Peringatan: Data Harian Belum Lengkap';
  const dateString = dateForDb.toISOString().split('T')[0];

  const alert = await prisma.alert.findFirst({
    where: {
      meter_id: meterId,
      title: alertTitle,
      description: {
        contains: dateString,
      },
      status: 'NEW',
    },
  });

  if (!alert) {
    return;
  }

  console.log(
    `[ReadingService] Alert data hilang ditemukan untuk meter ${meterId} pada ${dateString}. Memeriksa ulang kelengkapan...`,
  );

  const [meter, session, wbpType, lwbpType] = await Promise.all([
    prisma.meter.findUnique({
      where: { meter_id: meterId },
      include: { category: true },
    }),
    prisma.readingSession.findUnique({
      where: {
        unique_meter_reading_per_day: {
          meter_id: meterId,
          reading_date: dateForDb,
        },
      },
      include: { details: { select: { reading_type_id: true } } },
    }),
    prisma.readingType.findUnique({ where: { type_name: 'WBP' } }),
    prisma.readingType.findUnique({ where: { type_name: 'LWBP' } }),
  ]);

  if (!meter || !session || !wbpType || !lwbpType) {
    return;
  }

  let isDataComplete = true;
  if (meter.category.name.includes('Terminal')) {
    const detailTypeIds = new Set(session.details.map((det) => det.reading_type_id));
    if (
      !detailTypeIds.has(wbpType.reading_type_id) ||
      !detailTypeIds.has(lwbpType.reading_type_id)
    ) {
      isDataComplete = false;
    }
  } else if (session.details.length === 0) {
    isDataComplete = false;
  }

  if (isDataComplete) {
    await prisma.alert.update({
      where: { alert_id: alert.alert_id },
      data: { status: 'HANDLED' },
    });
    console.log(
      `[ReadingService] Data untuk meter ${meterId} pada ${dateString} telah lengkap. Alert ${alert.alert_id} diubah menjadi HANDLED.`,
    );
  }
};

export const _normalizeDate = (date: Date | string): Date => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;
  return new Date(dateString);
};
