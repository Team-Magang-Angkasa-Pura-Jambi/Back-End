import { schedule } from 'node-cron';
import prisma from '../../configs/db.js';
import { MeterStatus } from '../../generated/prisma/index.js';
import { alertService } from '../notifications/alert.service.js';

const READING_TYPES = {
  WBP: 'WBP',
  LWBP: 'LWBP',
};
const ALERT_TITLE = 'Peringatan: Data Harian Belum Lengkap';

/**
 * Fungsi Logic Pengecekan Data (Terpisah dari Cron)
 * Bisa dipanggil manual jika perlu.
 */
export async function checkDailyDataIntegrity() {
  console.log('🔍 [DataChecker] Memulai pengecekan kelengkapan data harian...');

  try {
    const now = new Date();

    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const [activeMeters, todaysSessions, wbpType, lwbpType] = await Promise.all([
      prisma.meter.findMany({
        where: { status: MeterStatus.Active },
        include: { category: true },
      }),
      prisma.readingSession.findMany({
        where: {
          reading_date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: {
          details: { select: { reading_type_id: true } },
        },
      }),
      prisma.readingType.findUnique({ where: { type_name: READING_TYPES.WBP } }),
      prisma.readingType.findUnique({ where: { type_name: READING_TYPES.LWBP } }),
    ]);

    if (!wbpType || !lwbpType) {
      console.error('❌ [DataChecker] Tipe bacaan WBP/LWBP tidak ditemukan di DB.');
      return;
    }

    const sessionsMap = new Map();
    todaysSessions.forEach((s) => sessionsMap.set(s.meter_id, s));

    const missingMeters = activeMeters.filter((meter) => {
      const session = sessionsMap.get(meter.meter_id);

      if (!session?.details || session.details.length === 0) {
        return true;
      }

      if (meter.category?.name?.toLowerCase().includes('terminal')) {
        const detailTypeIds = new Set(session.details.map((det: any) => det.reading_type_id));
        const hasWbp = detailTypeIds.has(wbpType.reading_type_id);
        const hasLwbp = detailTypeIds.has(lwbpType.reading_type_id);

        if (!hasWbp || !hasLwbp) {
          return true;
        }
      }

      return false;
    });

    if (missingMeters.length === 0) {
      console.log('✅ [DataChecker] Semua data meter aktif lengkap hari ini.');
      return;
    }

    console.log(
      `⚠️ [DataChecker] Ditemukan ${missingMeters.length} meter dengan data tidak lengkap.`,
    );

    const missingMeterIds = missingMeters.map((m) => m.meter_id);

    const existingAlerts = await prisma.alert.findMany({
      where: {
        meter_id: { in: missingMeterIds },
        title: ALERT_TITLE,
        alert_timestamp: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: { meter_id: true },
    });

    const existingAlertMeterIds = new Set(existingAlerts.map((a) => a.meter_id));

    const alertsToCreate = missingMeters.filter(
      (meter) => !existingAlertMeterIds.has(meter.meter_id),
    );

    if (alertsToCreate.length === 0) {
      console.log(
        'ℹ️ [DataChecker] Alert sudah ada untuk semua meter bermasalah. Tidak ada alert baru.',
      );
      return;
    }

    const createAlertPromises = alertsToCreate.map((meter) => {
      const description = `Data untuk meteran ${meter.meter_code} belum diinput atau tidak lengkap untuk tanggal ${startOfDay.toISOString().split('T')[0]}.`;

      return alertService.create({
        title: ALERT_TITLE,
        description: description,
        meter: {
          connect: {
            meter_id: meter.meter_id,
          },
        },
        status: 'NEW',
      });
    });

    await Promise.all(createAlertPromises);

    console.log(`✅ [DataChecker] Berhasil membuat ${alertsToCreate.length} alert baru.`);
  } catch (error) {
    console.error('❌ [DataChecker] Error Exception:', error);
  }
}

export function startDataCheckCron() {
  console.log('⏰ Cron job untuk pengecekan data diaktifkan (Jadwal: 12:00 Siang).');

  schedule('0 12 * * *', async () => {
    await checkDailyDataIntegrity();
  });
}
