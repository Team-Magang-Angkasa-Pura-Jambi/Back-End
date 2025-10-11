import { startDailyLogbookCron } from './services/corn/logbookGenerator.js';
import { startDataCheckCron } from './services/corn/dataChecker.js';
import { startPredictionRunnerCron } from './services/corn/predictionRunner.js';
import { startEfficiencyTargetScheduler } from './services/corn/efficiencyTarget.scheduler.js';
import { startNotificationCleanupScheduler } from './services/corn/notificationCleanup.scheduler.js';

/**
 * Menginisialisasi dan memulai semua cron job yang terdaftar di aplikasi.
 */
export function initializeCronJobs() {
  console.log('🚀 Menginisialisasi semua cron job...');
  startEfficiencyTargetScheduler();
  startDailyLogbookCron();
  startNotificationCleanupScheduler();
  startDataCheckCron();
  startPredictionRunnerCron();
}
