// src/services/cron/data-checker.ts

import { schedule } from 'node-cron';
import prisma from '../../configs/db.js';
import { MeterStatus } from '../../generated/prisma/index.js';
import { alertService } from '../notifications/alert.service.js';

export function startDataCheckCron() {
  console.log('⏰ Cron job untuk pengecekan data diaktifkan.');

  schedule('0 12 * * *', async () => {
    console.log('CRON: Memulai pengecekan data harian...');

    try {
      const localDate = new Date();
      const today = new Date(
        Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()),
      );

      const [activeMeters, todaysSessions, wbpType, lwbpType] = await Promise.all([
        prisma.meter.findMany({
          where: { status: MeterStatus.Active },
          include: { energy_type: true, category: true },
        }),
        prisma.readingSession.findMany({
          where: { reading_date: today },
          include: {
            details: { select: { reading_type_id: true } },
          },
        }),
        prisma.readingType.findUnique({ where: { type_name: 'WBP' } }),
        prisma.readingType.findUnique({ where: { type_name: 'LWBP' } }),
      ]);

      if (!wbpType || !lwbpType) {
        console.error('CRON: Tipe bacaan WBP/LWBP tidak ditemukan. Pengecekan detail dilewati.');
        return;
      }

      const sessionsMap = new Map(todaysSessions.map((s) => [s.meter_id, s]));

      const missingMeters = activeMeters.filter((meter) => {
        const session = sessionsMap.get(meter.meter_id);

        if (!session || session.details.length === 0) {
          return true;
        }

        if (meter.category.name.includes('Terminal')) {
          const detailTypeIds = new Set(session.details.map((det) => det.reading_type_id));
          const hasWbp = detailTypeIds.has(wbpType.reading_type_id);
          const hasLwbp = detailTypeIds.has(lwbpType.reading_type_id);

          if (!hasWbp || !hasLwbp) {
            return true;
          }
        }

        return false;
      });

      if (missingMeters.length === 0) {
        console.log('CRON: Semua data harian lengkap.');
        return;
      }

      const title = 'Peringatan: Data Harian Belum Lengkap';
      const startOfDay = today;
      const endOfDay = new Date(today);
      endOfDay.setUTCHours(23, 59, 59, 999);

      let createdAlertsCount = 0;

      for (const meter of missingMeters) {
        const existingAlert = await prisma.alert.findFirst({
          where: {
            meter_id: meter.meter_id,
            title,
            alert_timestamp: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });

        if (existingAlert) {
          console.log(`CRON: Alert untuk meter ${meter.meter_code} hari ini sudah ada. Dilewati.`);
          continue;
        }

        const description = `Data untuk meteran ${
          meter.meter_code
        } belum diinput atau tidak lengkap untuk tanggal ${today.toISOString().split('T')[0]}.`;

        await alertService.create({
          title,
          description,
          meter: {
            connect: {
              meter_id: meter.meter_id,
            },
          },
        });
        createdAlertsCount++;
      }

      console.log(`CRON: Selesai. ${createdAlertsCount} alert baru dibuat.`);
    } catch (error) {
      console.error('CRON: Terjadi error saat pengecekan data:', error);
    }
  });
}
