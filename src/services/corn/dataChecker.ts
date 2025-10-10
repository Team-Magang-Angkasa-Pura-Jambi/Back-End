// src/services/cron/data-checker.ts

import { schedule } from 'node-cron';
import prisma from '../../configs/db.js';
import { MeterStatus, RoleName } from '../../generated/prisma/index.js';
import { socketServer } from '../../socket-instance.js';
import { notificationService } from '../notification.service.js';

async function createAndNotify(
  userId: number,
  title: string,
  message: string,
  link: string
) {
  // 1. Simpan notifikasi ke database
  await prisma.notification.create({
    data: { user_id: userId, title, message, link },
  });
  // 2. Kirim sinyal update ke user yang bersangkutan
  socketServer.io.to(String(userId)).emit('new_notification_available');
}

export function startDataCheckCron() {
  console.log('⏰ Cron job untuk pengecekan data diaktifkan.');

  // Menjalankan setiap menit untuk kemudahan development.
  // Format: menit (0-59), jam (0-23), hari (1-31), bulan (1-12), hari dalam seminggu (0-7)
  schedule('* 12 * * *', async () => {
    console.log('CRON: Memulai pengecekan data harian...');

    try {
      // Buat tanggal berdasarkan zona waktu lokal server, lalu konversi ke UTC
      const localDate = new Date();
      const today = new Date(
        Date.UTC(
          localDate.getFullYear(),
          localDate.getMonth(),
          localDate.getDate()
        )
      );

      // LANGKAH 1: Ambil semua data relevan secara paralel
      const [
        activeMeters,
        todaysSessions,
        technicians,
        admins,
        wbpType,
        lwbpType,
      ] = await Promise.all([
        prisma.meter.findMany({
          where: { status: MeterStatus.Active },
          include: { energy_type: true, category: true }, // Sertakan kategori
        }),
        prisma.readingSession.findMany({
          where: { reading_date: today },
          include: {
            details: { select: { reading_type_id: true } }, // Sertakan detail
          },
        }),
        prisma.user.findMany({
          where: { role: { role_name: RoleName.Technician }, is_active: true },
          select: { user_id: true },
        }),
        prisma.user.findMany({
          where: {
            role: {
              role_name: {
                in: [RoleName.Admin, RoleName.SuperAdmin],
              },
            },
            is_active: true,
          },
          select: { user_id: true },
        }),
        prisma.readingType.findUnique({ where: { type_name: 'WBP' } }),
        prisma.readingType.findUnique({ where: { type_name: 'LWBP' } }),
      ]);

      if (!wbpType || !lwbpType) {
        console.error(
          'CRON: Tipe bacaan WBP/LWBP tidak ditemukan. Pengecekan detail dilewati.'
        );
        return;
      }

      // LANGKAH 2: Buat Map dari sesi yang ada untuk pencarian cepat
      const sessionsMap = new Map(todaysSessions.map((s) => [s.meter_id, s]));

      // LANGKAH 3: Filter untuk menemukan meteran yang datanya hilang atau tidak lengkap
      const missingMeters = activeMeters.filter((meter) => {
        const session = sessionsMap.get(meter.meter_id);

        // Kasus 1: Tidak ada sesi sama sekali, atau sesi ada tapi tidak punya detail.
        // Ini berlaku untuk SEMUA jenis meter, termasuk Air.
        if (!session || session.details.length === 0) {
          return true; // Data hilang atau tidak lengkap.
        }

        // Kasus 2: Meteran 'Listrik Terminal', cek kelengkapan WBP & LWBP.
        if (meter.category.name.includes('Terminal')) {
          const detailTypeIds = new Set(
            session.details.map((det) => det.reading_type_id)
          );
          const hasWbp = detailTypeIds.has(wbpType.reading_type_id);
          const hasLwbp = detailTypeIds.has(lwbpType.reading_type_id);

          // Data dianggap hilang jika salah satu atau keduanya tidak ada.
          if (!hasWbp || !hasLwbp) {
            return true;
          }
        }

        // Jika lolos semua cek di atas, data dianggap lengkap.
        return false;
      });

      if (missingMeters.length === 0) {
        // Notifikasi DATA LENGKAP untuk semua admin
        const message = `Semua data pembacaan meteran untuk hari ini telah berhasil diinput.`;
        // for (const admin of admins) {
        //   await notificationService.create({
        //     user_id: admin.user_id,
        //     title: 'Data Harian Lengkap',
        //     message,
        //     link: '/enter-data',
        //   });
        // }
        return;
      }

      // LANGKAH 4: Buat dan kirim notifikasi ringkasan
      const missingMetersMessage = missingMeters
        .map((meter) => meter.meter_code)
        .join(', ');
      const message = `Data untuk meteran berikut belum lengkap/diinput hari ini: ${missingMetersMessage}`;

      for (const tech of technicians) {
        await notificationService.create({
          user_id: tech.user_id,
          title: 'Pengingat Input Data',
          message,
          link: '/readings/new',
        });
      }
    } catch (error) {
      console.error('CRON: Terjadi error saat pengecekan data:', error);
    }
  });
}
