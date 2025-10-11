import { schedule } from 'node-cron';
import { notificationService } from '../notification.service.js';

/**
 * Menjalankan tugas terjadwal untuk membersihkan notifikasi lama.
 * Berjalan setiap hari Minggu jam 03:00 pagi.
 */
export function startNotificationCleanupScheduler() {
  console.log('⏰ Cron job untuk pembersihan notifikasi mingguan diaktifkan.');

  schedule(
    '0 3 * * 0', // At 03:00 on Sunday.
    async () => {
      const jobStartDate = new Date();
      console.log(
        `[CRON - NotificationCleanup] Memulai tugas pada ${jobStartDate.toLocaleString(
          'id-ID',
          { timeZone: 'Asia/Jakarta' }
        )}`
      );

      try {
        // PERBAIKAN: Tentukan batas waktu: notifikasi yang sudah dibaca dan lebih tua dari 3 hari akan dihapus.
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(jobStartDate.getDate() - 3);

        const result = await notificationService.deleteOldRead(threeDaysAgo);

        console.log(
          `[CRON - NotificationCleanup] Tugas selesai. ${result.count} notifikasi lama telah dihapus.`
        );
      } catch (error) {
        console.error('[CRON - NotificationCleanup] Terjadi error:', error);
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Jakarta',
    }
  );
}
