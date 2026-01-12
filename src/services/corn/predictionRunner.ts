// src/services/cron/predictionRunner.ts

import { schedule } from 'node-cron';
import { AnalysisService } from '../reports/analysis.service.js';

async function runPredictionForTomorrow() {
  console.log('[CRON - Prediction] Memulai tugas harian untuk menjalankan prediksi hari esok...');

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  try {
    // Panggil logika terpusat dari AnalysisService
    const analysisService = new AnalysisService();
    await analysisService.runPredictionForDate(today);
  } catch (error) {
    console.error(
      '[CRON - Prediction] Terjadi error saat menjalankan tugas prediksi harian:',
      error,
    );
  }
}

export function startPredictionRunnerCron() {
  console.log('⏰ Cron job untuk prediksi otomatis diaktifkan.');
  // PERBAIKAN: Menjalankan sekali setiap hari pada tengah malam (00:00).
  schedule('0 0 * * *', runPredictionForTomorrow);
}
