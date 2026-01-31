import { schedule } from 'node-cron';
import prisma from '../../configs/db.js';
import { alertService } from '../notifications/alert.service.js';

const ALERT_TITLE = 'Peringatan: Konfigurasi Harga Tidak Lengkap';

/**
 * Logic Pengecekan Integritas Harga
 * Terpisah dari Cron agar bisa dipanggil manual/test
 */
export async function runPriceConfigCheck() {
  const jobStart = performance.now();
  console.log(`[PriceChecker] 🔍 Memulai pengecekan konfigurasi harga...`);

  try {
    const activeSchemes = await prisma.priceScheme.findMany({
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

    const existingAlerts = await prisma.alert.findMany({
      where: {
        title: ALERT_TITLE,
      },
      select: { description: true },
    });

    const existingAlertDescriptions = new Set(existingAlerts.map((a) => a.description));

    const newAlertsPayloads: { title: string; description: string }[] = [];

    for (const scheme of activeSchemes) {
      const definedRateIds = new Set(scheme.rates.map((r) => r.reading_type_id));

      const requiredReadingTypes = new Map<number, string>();

      for (const meter of scheme.tariff_group.meters) {
        if (!meter.category?.allowed_reading_types) continue;

        for (const type of meter.category.allowed_reading_types) {
          requiredReadingTypes.set(type.reading_type_id, type.type_name);
        }
      }

      for (const [typeId, typeName] of requiredReadingTypes.entries()) {
        if (!definedRateIds.has(typeId)) {
          const description = `Skema harga "${scheme.scheme_name}" (Grup: ${scheme.tariff_group.group_code}) tidak memiliki tarif untuk "${typeName}".`;

          if (!existingAlertDescriptions.has(description)) {
            newAlertsPayloads.push({
              title: ALERT_TITLE,
              description: description,
            });

            existingAlertDescriptions.add(description);
          }
        }
      }
    }

    if (newAlertsPayloads.length > 0) {
      console.warn(
        `[PriceChecker] ⚠️ Ditemukan ${newAlertsPayloads.length} konfigurasi tidak lengkap.`,
      );

      await Promise.all(
        newAlertsPayloads.map((payload) =>
          alertService.create({
            title: payload.title,
            description: payload.description,
          }),
        ),
      );
    } else {
      console.log('[PriceChecker] ✅ Semua konfigurasi harga lengkap.');
    }

    const duration = ((performance.now() - jobStart) / 1000).toFixed(2);
    console.log(`[PriceChecker] Selesai dalam ${duration} detik.`);
  } catch (error) {
    console.error('[PriceChecker] ❌ Error:', error);
  }
}

/**
 * Scheduler Entry Point
 */
export function startPriceConfigCheckerScheduler() {
  console.log('⏰ Cron job Pengecekan Konfigurasi Harga: AKTIF (07:00 WIB).');

  schedule(
    '0 7 * * *',
    async () => {
      await runPriceConfigCheck();
    },
    {
      timezone: 'Asia/Jakarta',
    },
  );
}
