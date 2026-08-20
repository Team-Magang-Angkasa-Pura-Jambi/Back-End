import { Prisma } from '../../../generated/prisma/index.js';
import { Error400, Error404 } from '../../../utils/customError.js';

export const _normalizeDate = (date: Date | string): Date => {
  const d = new Date(date);
  if (isNaN(d.getTime())) throw new Error('Format tanggal tidak valid.');

  // 1. Ambil angka kalender sesuai yang user lihat (waktu lokal)
  const year = d.getFullYear();
  const month = d.getMonth(); // Ingat: Januari = 0
  const day = d.getDate();

  // 2. Kunci menjadi UTC midnight agar Prisma tidak menggesernya mundur
  return new Date(Date.UTC(year, month, day));
};

export const _validateMeter = async (meter_id: number, tx: any) => {
  const meter = await tx.meter.findUnique({
    where: { meter_id },
    include: {
      reading_configs: {
        include: {
          reading_type: true,
        },
      },
      tank_profile: true,
      calculation_template: true,
    },
  });
  if (!meter) throw new Error404(`Meteran dengan ID ${meter_id} tidak ditemukan.`);

  // Sesuaikan dengan ENUM terbaru: ACTIVE, INACTIVE, MAINTENANCE
  if (meter.status !== 'ACTIVE')
    throw new Error400(`Meteran ini tidak dapat digunakan karena berstatus ${meter.status}.`);

  return meter;
};

export const _checkUsageAgainstTargetAndNotify = async (
  userId: number,
  summary: Prisma.DailySummaryGetPayload<object>,
  meter: Prisma.MeterGetPayload<object>,
  tx: any,
): Promise<void> => {
  const target = await tx.efficiencyTarget.findFirst({
    where: {
      meter_id: meter.meter_id,
      period_start: { lte: summary.summary_date },
      period_end: { gte: summary.summary_date },
    },
  });

  if (!target) return;

  const baseline = new Prisma.Decimal(target.baseline_value);
  const reduction = baseline.times(new Prisma.Decimal(target.target_percentage));
  const targetLimit = baseline.minus(reduction);

  const currentUsage = new Prisma.Decimal(summary.total_usage);

  if (currentUsage.greaterThan(targetLimit)) {
    const title = 'Peringatan: Target Efisiensi Terlampaui';
    const message = `Pemakaian ${meter.meter_code} sebesar ${currentUsage.toString()} melebihi limit efisiensi (${targetLimit.toString()}).`;

    await tx.notification.create({
      data: {
        user_id: userId,
        category: 'ANOMALY_DETECTED',
        severity: 'CRITICAL',
        title,
        message,
        reference_table: 'daily_summaries',
        reference_id: summary.summary_id,
      },
    });

    console.log(`[Sentinel Alert] ${meter.meter_code} melebihi target.`);
  }
};
