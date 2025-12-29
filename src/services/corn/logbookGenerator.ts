import { schedule } from 'node-cron';
import prisma from '../../configs/db.js';
import { dailyLogbookService } from '../operations/dailyLogbook.service.js';
import { RoleName } from '../../generated/prisma/index.js';
import { notificationService } from '../notifications/notification.service.js';
import { alertService } from '../notifications/alert.service.js';

/**
 * Fungsi ini memeriksa apakah logbook untuk hari kemarin sudah ada.
 * Jika belum, ia akan memicu proses pembuatan logbook otomatis.
 */
async function generateLogbookForYesterdayIfNeeded() {
  console.log(
    `[CRON - Logbook] Memulai tugas pembuatan logbook harian pada ${new Date().toLocaleString(
      'id-ID',
      { timeZone: 'Asia/Jakarta' }
    )}`
  );

  try {
    // 1. Tentukan tanggal "kemarin" berdasarkan zona waktu Jakarta
    const jobStartDate = new Date();
    const nowInJakarta = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })
    );
    const yesterdayInJakarta = new Date(nowInJakarta);
    yesterdayInJakarta.setDate(nowInJakarta.getDate() - 1);

    // 2. Panggil service untuk membuat logbook.
    // Service akan menangani logika upsert (membuat jika belum ada, atau memperbarui jika sudah ada).
    console.log(
      `[CRON - Logbook] Log untuk ${
        yesterdayInJakarta.toISOString().split('T')[0]
      } akan dibuat/diperbarui.`
    );
    const createdLogs =
      await dailyLogbookService.generateDailyLog(yesterdayInJakarta);

    // BARU: Kirim notifikasi kinerja setelah tugas selesai
    const jobEndDate = new Date();
    const durationInSeconds =
      (jobEndDate.getTime() - jobStartDate.getTime()) / 1000;
    const performanceMessage = `Tugas pembuatan logbook harian selesai dalam ${durationInSeconds.toFixed(
      2
    )} detik. ${createdLogs.length} logbook telah dibuat/diperbarui.`;

    const admins = await prisma.user.findMany({
      where: {
        role: { role_name: { in: [RoleName.Admin, RoleName.SuperAdmin] } },
        is_active: true,
      },
      select: { user_id: true },
    });

    await alertService.create({
      title: 'Laporan Kinerja: Pembuatan Logbook',
      description: performanceMessage,
    });
    console.log(
      `[CRON - Logbook] Tugas selesai dalam ${durationInSeconds.toFixed(2)} detik.`
    );
  } catch (error) {
    console.error('[CRON - Logbook] Terjadi kesalahan:', error);
  }
}

export function startDailyLogbookCron() {
  console.log(
    '⏰ Cron job untuk logbook harian otomatis diaktifkan (setiap hari jam 02:00 WIB).'
  );
  // Menjalankan tugas setiap hari pada jam 02:00 pagi zona waktu Jakarta.
  schedule('0 2 * * *', generateLogbookForYesterdayIfNeeded, {
    scheduled: true,
    timezone: 'Asia/Jakarta',
  });
}
