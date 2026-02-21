import { differenceInDays } from 'date-fns';
import { Prisma } from '../../../generated/prisma/index.js';
import { Error400 } from '../../../utils/customError.js';

export const readingValidator = {
  async validate(meter: any, dateForDb: Date, details: any[], tx: Prisma.TransactionClient) {
    const futureSession = await tx.readingSession.findFirst({
      where: { meter_id: meter.meter_id, reading_date: { gt: dateForDb } },
    });

    if (futureSession) {
      throw new Error400(
        `Gagal: Sudah ada data yang lebih baru pada tanggal ${futureSession.reading_date.toISOString().split('T')[0]}.`,
      );
    }

    const prevSession = await tx.readingSession.findFirst({
      where: { meter_id: meter.meter_id, reading_date: { lt: dateForDb } },
      orderBy: { reading_date: 'desc' },
      include: { details: true },
    });

    if (prevSession) {
      if (!meter.allow_gap) {
        const diffDays = differenceInDays(dateForDb, prevSession.reading_date);
        if (diffDays > 1) {
          throw new Error400(
            `Data tidak urut. Data terakhir ditemukan pada ${prevSession.reading_date.toISOString().split('T')[0]}.`,
          );
        }
      }

      if (!meter.allow_decrease && !meter.rollover_limit) {
        for (const det of details) {
          const lastDet = prevSession.details.find(
            (d: any) => d.reading_type_id === det.reading_type_id,
          );
          if (lastDet) {
            const currentVal = new Prisma.Decimal(det.value);
            const prevVal = new Prisma.Decimal(lastDet.value);
            if (currentVal.lessThan(prevVal)) {
              throw new Error400(
                `Input (${currentVal.toString()}) tidak boleh lebih kecil dari stand sebelumnya (${prevVal.toString()}).`,
              );
            }
          }
        }
      }
    }

    for (const det of details) {
      const inputVal = new Prisma.Decimal(det.value);

      const config = meter.reading_configs?.find(
        (c: any) => c.reading_type_id === det.reading_type_id,
      );

      if (config) {
        if (
          config.alarm_max_threshold &&
          inputVal.greaterThan(new Prisma.Decimal(config.alarm_max_threshold))
        ) {
          throw new Error400(`Nilai input melebihi batas alarm maksimal sensor.`);
        }
        if (
          config.alarm_min_threshold &&
          inputVal.lessThan(new Prisma.Decimal(config.alarm_min_threshold))
        ) {
          throw new Error400(`Nilai input kurang dari batas alarm minimal sensor.`);
        }

        if (meter.tank_profile && config.reading_type) {
          const unit = config.reading_type.unit.toLowerCase();

          if (unit === 'cm') {
            const maxH = new Prisma.Decimal(meter.tank_profile.height_max_cm);
            if (inputVal.greaterThan(maxH)) {
              throw new Error400(
                `Input (${inputVal.toString()} cm) melebihi batas maksimal tinggi tangki (${maxH.toString()} cm).`,
              );
            }
          }

          if (unit === 'liters' || unit === 'liter') {
            const maxV = new Prisma.Decimal(meter.tank_profile.capacity_liters);
            if (inputVal.greaterThan(maxV)) {
              throw new Error400(
                `Input (${inputVal.toString()} L) melebihi kapasitas maksimal tangki (${maxV.toString()} L).`,
              );
            }
          }
        }
      }
    }
  },
};
