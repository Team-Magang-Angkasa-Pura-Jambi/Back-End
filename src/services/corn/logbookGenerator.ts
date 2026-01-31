import { schedule } from 'node-cron';
import { dailyLogbookService } from '../operations/dailyLogbook.service.js';
import { alertService } from '../notifications/alert.service.js';

/**
 * Logic Inti (Dipisah agar bisa ditest manual tanpa menunggu jam 2 pagi)
 */
export async function runLogbookGeneration() {
  const jobStart = new Date();
  console.log(`[LogbookCron] Memulai tugas pada ${jobStart.toISOString()}`);

  try {
    // 1. Tentukan Tanggal "Kemarin" dengan Aman
    // Cron jalan jam 02:00 pagi Hari Ini, berarti kita mau generate data Kemarin.
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - 1);

    // Reset jam ke awal hari untuk konsistensi query database (00:00:00)
    targetDate.setHours(0, 0, 0, 0);

    console.log(`[LogbookCron] Generating data untuk tanggal: ${targetDate.toDateString()}`);

    // 2. Panggil Service Utama
    // Pastikan service Anda siap menerima Date object, bukan string
    const createdLogs = await dailyLogbookService.generateDailyLog(targetDate);

    // 3. Hitung Durasi & Buat Laporan Kinerja
    const duration = (new Date().getTime() - jobStart.getTime()) / 1000;
    const logCount = createdLogs ? createdLogs.length : 0; // Handle jika void/null

    const message = `Tugas Logbook Harian selesai dalam ${duration.toFixed(2)} detik. ${logCount} logbook berhasil digenerate/diupdate.`;

    // 4. Kirim Notifikasi Sukses ke Dashboard Alert
    await alertService.create({
      title: 'Laporan Kinerja: Logbook Harian',
      description: message,
      // Opsional: Severity INFO karena ini rutinitas sukses
      // severity: 'INFO'
    });

    console.log(`[LogbookCron] Sukses. ${message}`);
  } catch (error) {
    console.error('[LogbookCron] Gagal:', error);

    // Penting: Buat Alert Error agar admin tahu logbook gagal dibuat
    await alertService.create({
      title: 'SYSTEM ERROR: Logbook Gagal',
      description: `Gagal generate logbook harian. Error: ${(error as Error).message}`,
    });
  }
}

/**
 * Entry Point Scheduler
 */
export function startDailyLogbookCron() {
  console.log('⏰ Cron job Logbook Harian: AKTIF (02:00 WIB).');

  // Jalan setiap jam 02:00 Pagi
  schedule(
    '0 2 * * *',
    async () => {
      await runLogbookGeneration();
    },
    {
      timezone: 'Asia/Jakarta',
    },
  );
}
