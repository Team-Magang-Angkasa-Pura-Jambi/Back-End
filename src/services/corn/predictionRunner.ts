// src/services/cron/predictionRunner.ts

import { schedule } from 'node-cron';
import prisma from '../../configs/db.js';
import { machineLearningService } from '../machineLearning.service.js';

const METER_ID_LISTRIK_TERMINAL = 9; // Asumsi ID untuk meter listrik utama
const METER_ID_AIR = 10; // Asumsi ID untuk meter air utama

async function runPredictionForTomorrow() {
  console.log(
    '[CRON - Prediction] Memulai pengecekan untuk menjalankan prediksi...'
  );

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setUTCDate(today.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  try {
    // 1. Cek apakah prediksi untuk besok sudah ada
    const existingPrediction = await prisma.consumptionPrediction.findFirst({
      where: { prediction_date: tomorrow },
    });

    if (existingPrediction) {
      console.log(
        `[CRON - Prediction] Prediksi untuk ${tomorrowStr} sudah ada. Pengecekan dihentikan.`
      );
      return;
    }

    // 2. Cek kelengkapan data hari ini
    const [paxToday, listrikToday, airToday] = await Promise.all([
      prisma.paxData.findUnique({ where: { data_date: today } }),
      prisma.readingSession.findUnique({
        where: {
          unique_meter_reading_per_day: {
            meter_id: METER_ID_LISTRIK_TERMINAL,
            reading_date: today,
          },
        },
      }),
      prisma.readingSession.findUnique({
        where: {
          unique_meter_reading_per_day: {
            meter_id: METER_ID_AIR,
            reading_date: today,
          },
        },
      }),
    ]);

    if (paxToday && listrikToday && airToday) {
      console.log(
        `[CRON - Prediction] Data hari ini lengkap. Menjalankan prediksi untuk ${tomorrowStr}...`
      );

      // 3. Panggil API ML untuk prediksi besok
      const prediction =
        await machineLearningService.getDailyPrediction(tomorrowStr);

      if (prediction) {
        // 4. Simpan hasil prediksi ke database secara paralel
        const modelVersion = 'terminal-v1.1'; // Versi model yang lebih deskriptif

        await Promise.all([
          // Simpan prediksi listrik untuk meteran terminal
          prisma.consumptionPrediction.upsert({
            where: {
              prediction_date_meter_id_model_version: {
                prediction_date: tomorrow,
                meter_id: METER_ID_LISTRIK_TERMINAL,
                model_version: modelVersion,
              },
            },
            update: { predicted_value: prediction.prediksi_listrik_kwh },
            create: {
              prediction_date: tomorrow,
              predicted_value: prediction.prediksi_listrik_kwh,
              meter_id: METER_ID_LISTRIK_TERMINAL,
              model_version: modelVersion,
            },
          }),
          // BARU: Simpan prediksi air untuk meteran air
          prisma.consumptionPrediction.upsert({
            where: {
              prediction_date_meter_id_model_version: {
                prediction_date: tomorrow,
                meter_id: METER_ID_AIR,
                model_version: modelVersion,
              },
            },
            update: { predicted_value: prediction.prediksi_air_m3 },
            create: {
              prediction_date: tomorrow,
              predicted_value: prediction.prediksi_air_m3,
              meter_id: METER_ID_AIR,
              model_version: modelVersion,
            },
          }),
        ]);

        console.log(
          `[CRON - Prediction] Hasil prediksi untuk ${tomorrowStr} berhasil disimpan.`
        );
      }
    } else {
      console.log(
        '[CRON - Prediction] Data hari ini belum lengkap. Prediksi tidak dijalankan.'
      );
    }
  } catch (error) {
    console.error(
      '[CRON - Prediction] Terjadi error saat menjalankan prediksi:',
      error
    );
  }
}

export function startPredictionRunnerCron() {
  console.log('⏰ Cron job untuk prediksi otomatis diaktifkan.');
  // Menjalankan setiap jam pada menit ke-5
  schedule('5 * * * *', runPredictionForTomorrow);
}
