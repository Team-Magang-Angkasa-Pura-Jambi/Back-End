import { schedule } from 'node-cron';
import prisma from '../../configs/db.js';
import { MeterStatus } from '../../generated/prisma/index.js';

import { predictTerminal, predictOffice } from '../intelligence/predict.service.js';
import { alertService } from '../notifications/alert.service.js';

/**
 * Logic Eksekusi Prediksi Harian
 */
export async function runDailyPrediction() {
  const jobStart = new Date();
  console.log(`[PredictionCron] 🚀 Memulai tugas prediksi pada ${jobStart.toISOString()}`);

  try {
    const targetDate = new Date();
    targetDate.setHours(0, 0, 0, 0);

    const activeMeters = await prisma.meter.findMany({
      where: { status: MeterStatus.Active },
      include: { category: true },
    });

    if (activeMeters.length === 0) {
      console.log('[PredictionCron] ⚠️ Tidak ada meter aktif. Tugas dihentikan.');
      return;
    }

    console.log(
      `[PredictionCron] Menjalankan prediksi untuk ${activeMeters.length} meter aktif...`,
    );

    const predictionPromises = activeMeters.map(async (meter) => {
      try {
        const categoryName = meter.category?.name?.toLowerCase() || '';

        if (categoryName.includes('terminal')) {
          return await predictTerminal(targetDate, meter.meter_id);
        } else {
          return await predictOffice(targetDate, meter.meter_id);
        }
      } catch (err) {
        console.error(`[PredictionCron] ❌ Gagal prediksi meter ${meter.meter_code}:`, err);
        return null;
      }
    });

    const results = await Promise.all(predictionPromises);

    const successCount = results.filter((r) => r !== null).length;
    const failCount = activeMeters.length - successCount;

    const duration = ((new Date().getTime() - jobStart.getTime()) / 1000).toFixed(2);
    const message = `Tugas prediksi selesai dalam ${duration} detik. Sukses: ${successCount}, Gagal: ${failCount}.`;

    console.log(`[PredictionCron] ✅ ${message}`);

    if (failCount > 0) {
      await alertService.create({
        title: 'WARNING: Prediksi Harian Tidak Sempurna',
        description: `Terdapat ${failCount} meter gagal diprediksi. ${message}`,
      });
    }
  } catch (error) {
    console.error('[PredictionCron] 💥 CRITICAL ERROR:', error);

    await alertService.create({
      title: 'CRITICAL: Prediksi Harian Gagal Total',
      description: `Sistem gagal menjalankan routine prediksi. Error: ${(error as Error).message}`,
    });
  }
}

/**
 * Scheduler Entry Point
 */
export function startPredictionRunnerCron() {
  console.log('⏰ Cron job Prediksi Otomatis: AKTIF (00:00 WIB).');

  schedule(
    '0 0 * * *',
    async () => {
      await runDailyPrediction();
    },
    {
      timezone: 'Asia/Jakarta',
    },
  );
}
