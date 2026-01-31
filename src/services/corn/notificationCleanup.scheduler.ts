import { schedule } from 'node-cron';
import { notificationService } from '../notifications/notification.service.js';
import { alertService } from '../notifications/alert.service.js';

// --- KONFIGURASI ---
const RETENTION_DAYS = 7; // Simpan notifikasi 7 hari terakhir (rekomendasi: jangan terlalu pendek)

/**
 * Logic Pembersihan (Terpisah dari Cron)
 * Bisa dipanggil manual via API maintenance jika perlu.
 */
export async function runNotificationCleanup() {
  const jobStart = performance.now(); // Menggunakan performance.now untuk presisi tinggi
  const today = new Date();

  console.log(`[CleanupCron] Memulai pembersihan notifikasi pada ${today.toISOString()}`);

  try {
    // 1. Hitung Tanggal Batas (Cutoff Date)
    // Hapus data yang LEBIH TUA dari tanggal ini
    const cutoffDate = new Date();
    cutoffDate.setDate(today.getDate() - RETENTION_DAYS);
    // Set ke akhir hari tersebut (23:59:59) agar pembersihan tuntas
    cutoffDate.setHours(23, 59, 59, 999);

    console.log(
      `[CleanupCron] Menghapus notifikasi yang sudah dibaca sebelum: ${cutoffDate.toISOString().split('T')[0]}`,
    );

    // 2. Eksekusi Penghapusan
    const result = await notificationService.deleteOldRead(cutoffDate);

    // 3. Logging & Monitoring
    const duration = ((performance.now() - jobStart) / 1000).toFixed(2);

    // Log ke console (Wajib)
    console.log(`[CleanupCron] Selesai dalam ${duration}s. ${result.count} notifikasi dihapus.`);

    // Opsional: Buat Alert Laporan jika jumlah yang dihapus sangat banyak (anomali)
    // Misal: Jika menghapus > 1000 notifikasi, beri tahu admin.
    if (result.count > 1000) {
      await alertService.create({
        title: 'Maintenance Info: Cleanup Besar',
        description: `Pembersihan mingguan menghapus ${result.count} notifikasi lama. Durasi: ${duration} detik.`,
      });
    }
  } catch (error) {
    console.error('[CleanupCron] GAGAL:', error);

    // PENTING: Buat Alert jika cron gagal agar database tidak bloated
    await alertService.create({
      title: 'SYSTEM ERROR: Notification Cleanup Failed',
      description: `Gagal membersihkan notifikasi lama. DB berisiko penuh. Error: ${(error as Error).message}`,
    });
  }
}

/**
 * Entry Point Scheduler
 */
export function startNotificationCleanupScheduler() {
  console.log(
    `⏰ Cron job Cleanup Notifikasi: AKTIF (Setiap Minggu 03:00 WIB). Retensi: ${RETENTION_DAYS} hari.`,
  );

  // Jalan setiap Minggu jam 03:00 Pagi
  schedule(
    '0 3 * * 0',
    async () => {
      await runNotificationCleanup();
    },
    {
      timezone: 'Asia/Jakarta',
    },
  );
}
