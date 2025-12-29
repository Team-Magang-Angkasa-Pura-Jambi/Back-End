import { schedule } from 'node-cron';
import prisma from '../../configs/db.js';
import { RoleName } from '../../generated/prisma/index.js';
import { alertService } from '../notifications/alert.service.js';

/**
 * Memeriksa semua skema harga yang aktif untuk memastikan konfigurasinya lengkap.
 * Jika ada tarif yang hilang untuk jenis pembacaan yang diizinkan,
 * sebuah alert akan dibuat untuk admin.
 */
async function checkPriceConfigurations() {
  const jobStartDate = new Date();
  console.log(
    `[CRON - PriceConfigChecker] Memulai tugas pada ${jobStartDate.toLocaleString(
      'id-ID',
      { timeZone: 'Asia/Jakarta' }
    )}`
  );

  try {
    const activePriceSchemes = await prisma.priceScheme.findMany({
      where: { is_active: true },
      include: {
        rates: { select: { reading_type_id: true } },
        tariff_group: {
          include: {
            meters: {
              include: {
                category: {
                  include: { allowed_reading_types: true },
                },
              },
            },
          },
        },
      },
    });

    for (const scheme of activePriceSchemes) {
      const assignedMeter = scheme.tariff_group.meters[0];
      if (!assignedMeter) continue; // Lewati jika golongan tarif tidak digunakan

      const allowedReadingTypes = assignedMeter.category.allowed_reading_types;
      const definedRateTypeIds = new Set(
        scheme.rates.map((r) => r.reading_type_id)
      );

      for (const readingType of allowedReadingTypes) {
        if (!definedRateTypeIds.has(readingType.reading_type_id)) {
          // Ditemukan tarif yang hilang! Buat Alert.
          const title = 'Peringatan: Konfigurasi Harga Tidak Lengkap';
          const description = `Skema harga "${scheme.scheme_name}" untuk golongan tarif "${scheme.tariff_group.group_code}" tidak memiliki tarif untuk jenis pembacaan "${readingType.type_name}". Mohon segera lengkapi konfigurasi.`;

          // Cek apakah alert serupa sudah ada
          const existingAlert = await prisma.alert.findFirst({
            where: { title, description },
          });

          if (!existingAlert) {
            await alertService.create({
              title,
              description,
              // BARU: Tambahkan nilai null eksplisit untuk field opsional
              meter_id: null,
              actual_value: null,
              target_value_at_trigger: null,
            });
            console.warn(
              `[CRON - PriceConfigChecker] ALERT DIBUAT: ${description}`
            );
          }
        }
      }
    }
    console.log(
      '[CRON - PriceConfigChecker] Pengecekan konfigurasi harga selesai.'
    );
  } catch (error) {
    console.error('[CRON - PriceConfigChecker] Terjadi error:', error);
  }
}

export function startPriceConfigCheckerScheduler() {
  console.log('⏰ Cron job untuk pengecekan konfigurasi harga diaktifkan.');

  // Berjalan setiap hari jam 07:00 pagi
  schedule('0 7 * * *', checkPriceConfigurations, {
    scheduled: true,
    timezone: 'Asia/Jakarta',
  });
}
