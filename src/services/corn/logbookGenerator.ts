import { schedule } from 'node-cron';
import { dailyLogbookService } from '../operations/dailyLogbook.service.js';
import { alertService } from '../notifications/alert.service.js';

async function generateLogbookForYesterdayIfNeeded() {
  console.log(
    `[CRON - Logbook] Memulai tugas pembuatan logbook harian pada ${new Date().toLocaleString(
      'id-ID',
      { timeZone: 'Asia/Jakarta' },
    )}`,
  );

  try {
    const jobStartDate = new Date();
    const nowInJakarta = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const yesterdayInJakarta = new Date(nowInJakarta);
    yesterdayInJakarta.setDate(nowInJakarta.getDate() - 1);

    console.log(
      `[CRON - Logbook] Log untuk ${
        yesterdayInJakarta.toISOString().split('T')[0]
      } akan dibuat/diperbarui.`,
    );
    const createdLogs = await dailyLogbookService.generateDailyLog(yesterdayInJakarta);

    const jobEndDate = new Date();
    const durationInSeconds = (jobEndDate.getTime() - jobStartDate.getTime()) / 1000;
    const performanceMessage = `Tugas pembuatan logbook harian selesai dalam ${durationInSeconds.toFixed(
      2,
    )} detik. ${createdLogs.length} logbook telah dibuat/diperbarui.`;

    await alertService.create({
      title: 'Laporan Kinerja: Pembuatan Logbook',
      description: performanceMessage,
    });
    console.log(`[CRON - Logbook] Tugas selesai dalam ${durationInSeconds.toFixed(2)} detik.`);
  } catch (error) {
    console.error('[CRON - Logbook] Terjadi kesalahan:', error);
  }
}

export function startDailyLogbookCron() {
  console.log('⏰ Cron job untuk logbook harian otomatis diaktifkan (setiap hari jam 02:00 WIB).');

  schedule('0 2 * * *', generateLogbookForYesterdayIfNeeded, {
    timezone: 'Asia/Jakarta',
  });
}
