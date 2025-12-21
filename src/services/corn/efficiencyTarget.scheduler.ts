import { schedule } from 'node-cron';
import prisma from '../../configs/db.js';
import { MeterStatus, RoleName } from '../../generated/prisma/index.js';
import { notificationService } from '../notification.service.js';
import { Prisma } from '../../generated/prisma/index.js';
import { alertService } from '../alert.service.js';

const EFFICIENCY_IMPROVEMENT_PERCENTAGE = 0.05; // Target efisiensi 5% lebih baik

/**
 * Menjalankan tugas terjadwal untuk mengatur target efisiensi bulanan secara otomatis.
 * Berjalan pada jam 01:00 pada hari pertama setiap bulan.
 */
export function startEfficiencyTargetScheduler() {
  console.log(
    '⏰ Cron job untuk pengaturan target efisiensi bulanan diaktifkan.'
  );

  schedule(
    '0 1 1 * *', // At 01:00 on day-of-month 1.
    async () => {
      const jobStartDate = new Date();
      console.log(
        `[CRON - EfficiencyTarget] Memulai tugas pada ${jobStartDate.toLocaleString(
          'id-ID',
          {
            timeZone: 'Asia/Jakarta',
          }
        )}`
      );

      try {
        // Tentukan periode target (bulan ini) dan periode kalkulasi (bulan lalu)
        const targetYear = jobStartDate.getUTCFullYear();
        const targetMonth = jobStartDate.getUTCMonth(); // 0-11

        const period_start = new Date(Date.UTC(targetYear, targetMonth, 1));
        const period_end = new Date(Date.UTC(targetYear, targetMonth + 1, 0));

        const calcStartDate = new Date(
          Date.UTC(targetYear, targetMonth - 1, 1)
        );
        const calcEndDate = new Date(Date.UTC(targetYear, targetMonth, 0));

        // Ambil semua meter aktif dan admin
        const [activeMeters, admins] = await Promise.all([
          prisma.meter.findMany({
            where: { status: MeterStatus.Active },
            // BARU: Sertakan relasi yang dibutuhkan untuk kalkulasi biaya
            include: {
              tariff_group: {
                include: {
                  price_schemes: {
                    include: { rates: { include: { reading_type: true } } },
                  },
                },
              },
            },
          }),
          prisma.user.findMany({
            where: {
              role: {
                role_name: { in: [RoleName.Admin, RoleName.SuperAdmin] },
              },
              is_active: true,
            },
            select: { user_id: true },
          }),
        ]);

        let createdTargetsCount = 0;

        for (const meter of activeMeters) {
          // Hitung total konsumsi bulan lalu untuk meter ini
          const lastMonthAggregation = await prisma.dailySummary.aggregate({
            _sum: { total_consumption: true },
            _count: { summary_id: true },
            where: {
              meter_id: meter.meter_id,
              summary_date: {
                gte: calcStartDate,
                lte: calcEndDate,
              },
            },
          });

          const totalConsumption =
            lastMonthAggregation._sum.total_consumption?.toNumber() ?? 0;
          const daysWithData = lastMonthAggregation._count.summary_id;

          if (daysWithData === 0) {
            console.log(
              `[CRON - EfficiencyTarget] Meter ${meter.meter_code} tidak memiliki data bulan lalu. Target dilewati.`
            );
            continue;
          }

          // Hitung rata-rata harian dan target baru
          const averageDailyConsumption = totalConsumption / daysWithData;
          const newTargetValue =
            averageDailyConsumption * (1 - EFFICIENCY_IMPROVEMENT_PERCENTAGE);

          // BARU: Hitung estimasi biaya untuk target baru
          let estimatedTargetCost = new Prisma.Decimal(0);
          const activePriceScheme = meter.tariff_group.price_schemes
            .filter((ps) => ps.effective_date <= period_start && ps.is_active)
            .sort(
              (a, b) => b.effective_date.getTime() - a.effective_date.getTime()
            )[0];

          if (activePriceScheme) {
            // Asumsi sederhana: untuk listrik, bagi rata target ke WBP dan LWBP
            // Ini bisa disempurnakan jika ada data rasio historis
            const wbpRate =
              activePriceScheme.rates.find(
                (r) => r.reading_type.type_name === 'WBP'
              )?.value ?? new Prisma.Decimal(0);
            const lwbpRate =
              activePriceScheme.rates.find(
                (r) => r.reading_type.type_name === 'LWBP'
              )?.value ?? new Prisma.Decimal(0);

            if (!wbpRate.isZero() && !lwbpRate.isZero()) {
              const avgPrice = wbpRate.plus(lwbpRate).div(2);
              estimatedTargetCost = new Prisma.Decimal(newTargetValue).times(
                avgPrice
              );
            } else {
              // Untuk Air atau Fuel
              const singleRate =
                activePriceScheme.rates[0]?.value ?? new Prisma.Decimal(0);
              estimatedTargetCost = new Prisma.Decimal(newTargetValue).times(
                singleRate
              );
            }
          }

          // Buat atau perbarui target untuk bulan ini
          await prisma.efficiencyTarget.create({
            data: {
              kpi_name: `Target Efisiensi Bulanan - ${
                period_start.toISOString().split('T')[0]
              }`,
              target_value: new Prisma.Decimal(newTargetValue.toFixed(2)),
              // BARU: Simpan estimasi biaya target
              target_cost: estimatedTargetCost,
              period_start,
              period_end,
              meter_id: meter.meter_id,
              set_by_user_id: admins[0].user_id, // Diasumsikan diatur oleh sistem/admin pertama
            },
          });
          createdTargetsCount++;
        }

        const jobEndDate = new Date();
        const durationInSeconds =
          (jobEndDate.getTime() - jobStartDate.getTime()) / 1000;

        if (createdTargetsCount > 0) {
          const message = `Sistem telah membuat ${createdTargetsCount} target efisiensi baru untuk periode ${period_start.toLocaleDateString()}.`;
          for (const admin of admins) {
            await notificationService.create({
              user_id: admin.user_id,
              title: 'Target Efisiensi Bulanan Dibuat',
              message,
            });
          }
        }

        // Kirim notifikasi kinerja sistem
        const performanceMessage = `Tugas penjadwalan target efisiensi selesai dalam ${durationInSeconds.toFixed(2)} detik. ${createdTargetsCount} target berhasil dibuat.`;
        await alertService.create({
          title: 'Laporan Kinerja: Penjadwalan Target',
          description: performanceMessage,
        });

        console.log(
          `[CRON - EfficiencyTarget] Tugas selesai dalam ${durationInSeconds.toFixed(2)} detik.`
        );
      } catch (error) {
        console.error('[CRON - EfficiencyTarget] Terjadi error:', error);
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Jakarta',
    }
  );
}
