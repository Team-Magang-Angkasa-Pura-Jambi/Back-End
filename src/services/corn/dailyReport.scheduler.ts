import { schedule } from 'node-cron';
import prisma from '../../configs/db.js';
import { alertService } from '../notifications/alert.service.js';

/**
 * Cron job untuk membuat ringkasan laporan harian sistem.
 * Berjalan setiap hari jam 7 pagi.
 */
export function startDailyReportScheduler() {
  console.log('⏰ Cron job untuk Laporan Harian Sistem diaktifkan.');

  schedule(
    '0 7 * * *', // Setiap hari jam 07:00
    async () => {
      const jobStartDate = new Date();
      console.log(
        `[CRON - DailyReport] Memulai pembuatan laporan harian pada ${jobStartDate.toLocaleString(
          'id-ID',
          { timeZone: 'Asia/Jakarta' },
        )}`,
      );

      try {
        // Tentukan rentang waktu (kemarin)
        const today = new Date(jobStartDate);
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        // 1. Kumpulkan data dari 24 jam terakhir
        const [newAlertsCount, handledAlertsCount, cronReports] = await Promise.all([
          // Hitung alert baru yang dibuat kemarin
          prisma.alert.count({
            where: {
              alert_timestamp: { gte: yesterday, lt: today },
              NOT: { title: { startsWith: 'Laporan' } }, // Abaikan alert laporan itu sendiri
            },
          }),
          // Hitung alert yang diselesaikan kemarin
          prisma.alert.count({
            where: {
              status: 'HANDLED',
              updated_at: { gte: yesterday, lt: today },
            },
          }),
          // Ambil laporan kinerja dari cron job lain
          prisma.alert.findMany({
            where: {
              title: { startsWith: 'Laporan Kinerja' },
              alert_timestamp: { gte: yesterday, lt: today },
            },
            select: { title: true, description: true },
          }),
        ]);

        // 2. Susun deskripsi laporan
        let description = `Ringkasan aktivitas sistem untuk tanggal ${
          yesterday.toISOString().split('T')[0]
        }:\n`;
        description += `- ${newAlertsCount} peringatan baru dibuat.\n`;
        description += `- ${handledAlertsCount} peringatan berhasil diselesaikan (status: HANDLED).\n\n`;
        description += `Laporan Tugas Otomatis:\n`;
        if (cronReports.length > 0) {
          cronReports.forEach((report) => {
            description += `- ${report.title}: Sukses.\n`;
          });
        } else {
          description += `- Tidak ada laporan kinerja dari tugas otomatis.\n`;
        }

        // 3. Buat satu Alert Sistem sebagai laporan harian
        await alertService.create({
          title: 'Laporan Harian Sistem',
          description,
        });

        console.log('[CRON - DailyReport] Laporan harian sistem berhasil dibuat.');
      } catch (error) {
        console.error('[CRON - DailyReport] Gagal membuat laporan harian:', error);
        // Jika gagal, buat alert error
        await alertService.create({
          title: 'Error Sistem: Laporan Harian Gagal',
          description: `Cron job untuk membuat laporan harian sistem gagal. Error: ${error.message}`,
        });
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Jakarta',
    },
  );
}
