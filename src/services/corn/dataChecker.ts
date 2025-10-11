// src/services/cron/data-checker.ts

import { schedule } from 'node-cron';
import prisma from '../../configs/db.js';
import { MeterStatus } from '../../generated/prisma/index.js';
import { alertService } from '../alert.service.js';

export function startDataCheckCron() {
  console.log('⏰ Cron job untuk pengecekan data diaktifkan.');

  // PERBAIKAN: Jadwal diubah agar berjalan sekali sehari pada jam 12:00 siang.
  // Format: menit (0), jam (12), hari (*), bulan (*), hari dalam seminggu (*)
  schedule('0 12 * * *', async () => {
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
      const [activeMeters, todaysSessions, wbpType, lwbpType] =
        await Promise.all([
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
        console.log('CRON: Semua data harian lengkap.');
        return;
      }

      // LANGKAH 4: Buat satu Alert sistem yang merangkum semua data yang hilang
      const missingMetersMessage = missingMeters
        .map((meter) => meter.meter_code)
        .join(', ');
      const title = 'Peringatan: Data Harian Belum Lengkap';
      const description = `Data untuk meteran berikut belum diinput atau tidak lengkap untuk tanggal ${
        today.toISOString().split('T')[0]
      }: ${missingMetersMessage}.`;

      // Buat Alert sistem (tanpa meter_id spesifik)
      await alertService.create({
        title,
        description,
      });
      console.log(
        `CRON: Alert dibuat untuk data yang hilang pada ${missingMeters.length} meter.`
      );
    } catch (error) {
      console.error('CRON: Terjadi error saat pengecekan data:', error);
    }
  });
}
