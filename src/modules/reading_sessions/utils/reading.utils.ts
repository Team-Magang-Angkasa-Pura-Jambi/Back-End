import { Prisma } from '../../../generated/prisma/index.js';
import { Error400, Error404 } from '../../../utils/customError.js';

export const _normalizeDate = (date: Date | string): Date => {
  const d = new Date(date);
  if (isNaN(d.getTime())) throw new Error('Format tanggal tidak valid.');

  return d; // Kembalikan object Date utuh (Jam/Menit/Detik tetap ada)
};

export const _validateMeter = async (meter_id: number, tx: Prisma.TransactionClient) => {
  const meter = await tx.meter.findUnique({
    where: { meter_id },
    include: {
      energy_type: true,
      tank_profile: true,
      // Include Atribut Spesifikasi Alat & Konfigurasi Sensor
      // specs: {
      //   include: { attribute: true },
      // },
      reading_configs: true,
      calculation_template: {
        include: { definitions: true },
      },
    },
  });

  if (!meter) throw new Error404(`Meteran dengan ID ${meter_id} tidak ditemukan.`);

  // Sesuaikan dengan ENUM terbaru: ACTIVE, INACTIVE, MAINTENANCE
  if (meter.status !== 'ACTIVE')
    throw new Error400(`Meteran ini tidak dapat digunakan karena berstatus ${meter.status}.`);

  return meter;
};

export const _checkUsageAgainstTargetAndNotify = async (
  summary: Prisma.DailySummaryGetPayload<object>,
  meter: Prisma.MeterGetPayload<object>,
  tx: Prisma.TransactionClient,
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
        user_id: meter.created_by ?? 1,
        category: 'ALERT',
        severity: 'MEDIUM',
        title,
        message,
        reference_table: 'daily_summaries',
        reference_id: summary.summary_id,
      },
    });

    console.log(`[Sentinel Alert] ${meter.meter_code} melebihi target.`);
  }
};
