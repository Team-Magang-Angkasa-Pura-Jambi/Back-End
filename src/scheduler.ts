import { startDailyLogbookCron } from './services/corn/logbookGenerator.js';
import { startDataCheckCron } from './services/corn/dataChecker.js';
import { startPredictionRunnerCron } from './services/corn/predictionRunner.js';

/**
 * Menginisialisasi dan memulai semua cron job yang terdaftar di aplikasi.
 */
export function initializeCronJobs() {
  console.log('🚀 Menginisialisasi semua cron job...');
  startDailyLogbookCron();
  startDataCheckCron();
  startPredictionRunnerCron();
}
