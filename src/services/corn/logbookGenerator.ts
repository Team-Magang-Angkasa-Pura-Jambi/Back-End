import { schedule } from 'node-cron';
import prisma from '../../configs/db.js';
import { dailyLogbookService } from '../dailyLogbook.service.js';

/**
 * Fungsi ini memeriksa apakah logbook untuk hari kemarin sudah ada.
 * Jika belum, ia akan memicu proses pembuatan logbook otomatis.
 */
async function generateLogbookForYesterdayIfNeeded() {
  console.log(
    '[CRON - Logbook] Memulai pengecekan untuk pembuatan logbook harian...'
  );

  try {
    // 1. Tentukan tanggal "kemarin" berdasarkan UTC
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0); // Normalisasi ke awal hari

    // 2. Cek apakah log untuk tanggal kemarin sudah ada di database
    const existingLog = await prisma.dailyLogbook.findUnique({
      where: { log_date: yesterday },
    });

    // 3. Logika Pengecekan Status
    if (existingLog) {
      console.log(
        `[CRON - Logbook] Log untuk tanggal ${
          yesterday.toISOString().split('T')[0]
        } sudah ada. Tidak ada tindakan yang diperlukan.`
      );
      return; // Hentikan proses jika log sudah ada
    }

    // 4. Jika log belum ada, jalankan proses pembuatan
    console.log(
      `[CRON - Logbook] Log untuk ${
        yesterday.toISOString().split('T')[0]
      } tidak ditemukan. Memulai proses pembuatan...`
    );
    await dailyLogbookService.generateDailyLog(yesterday);
  } catch (error) {
    console.error('[CRON - Logbook] Terjadi kesalahan:', error);
  }
}

export function startDailyLogbookCron() {
  console.log('⏰ Cron job untuk logbook harian otomatis diaktifkan.');
  // Menjalankan tugas setiap jam.
  schedule('0 * * * *', generateLogbookForYesterdayIfNeeded);
}
