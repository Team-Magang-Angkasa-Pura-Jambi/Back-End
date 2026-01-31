import { schedule } from 'node-cron';
import prisma from '../../configs/db.js';
import { MeterStatus, RoleName, Prisma } from '../../generated/prisma/index.js';
import { notificationService } from '../notifications/notification.service.js';
import { alertService } from '../notifications/alert.service.js';

const EFFICIENCY_IMPROVEMENT_PERCENTAGE = 0.05;

const calculateEstimatedCost = (targetValue: number, priceSchemes: any[]): Prisma.Decimal => {
  const activeScheme = priceSchemes?.[0];

  if (!activeScheme?.rates) return new Prisma.Decimal(0);

  const wbpRate =
    activeScheme.rates.find((r: any) => r.reading_type.type_name === 'WBP')?.value ??
    new Prisma.Decimal(0);
  const lwbpRate =
    activeScheme.rates.find((r: any) => r.reading_type.type_name === 'LWBP')?.value ??
    new Prisma.Decimal(0);

  let finalPrice = new Prisma.Decimal(0);

  if (!wbpRate.isZero() && !lwbpRate.isZero()) {
    finalPrice = wbpRate.add(lwbpRate).div(2);
  } else {
    finalPrice = activeScheme.rates[0]?.value ?? new Prisma.Decimal(0);
  }

  return new Prisma.Decimal(targetValue).mul(finalPrice);
};

export function startEfficiencyTargetScheduler() {
  console.log('⏰ Cron job Target Efisiensi Bulanan: AKTIF (01:00 tgl 1).');

  schedule(
    '0 1 1 * *',
    async () => {
      const jobStart = new Date();
      console.log(`[EfficiencyCron] Memulai job pada ${jobStart.toISOString()}`);

      try {
        const now = new Date();

        const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

        const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

        const calcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const calcEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59));

        const [activeMeters, consumptionStats, systemAdmin] = await Promise.all([
          prisma.meter.findMany({
            where: { status: MeterStatus.Active },
            include: {
              tariff_group: {
                include: {
                  price_schemes: {
                    where: { is_active: true, effective_date: { lte: periodStart } },
                    orderBy: { effective_date: 'desc' },
                    take: 1,
                    include: { rates: { include: { reading_type: true } } },
                  },
                },
              },
            },
          }),

          prisma.dailySummary.groupBy({
            by: ['meter_id'],
            where: {
              summary_date: { gte: calcStart, lte: calcEnd },
            },
            _sum: { total_consumption: true },
            _count: { summary_id: true },
          }),

          prisma.user.findFirst({
            where: {
              role: { role_name: RoleName.SuperAdmin },
              is_active: true,
            },
            select: { user_id: true },
          }),
        ]);

        if (!systemAdmin)
          throw new Error('Tidak ditemukan SuperAdmin aktif untuk menjadwalkan target.');

        const statsMap = new Map();
        consumptionStats.forEach((stat) => {
          statsMap.set(stat.meter_id, {
            total: stat._sum.total_consumption?.toNumber() ?? 0,
            days: stat._count.summary_id,
          });
        });

        const operations = [];

        for (const meter of activeMeters) {
          const stats = statsMap.get(meter.meter_id);

          if (!stats || stats.days === 0) continue;

          const avgDaily = stats.total / stats.days;
          const newTargetVal = avgDaily * (1 - EFFICIENCY_IMPROVEMENT_PERCENTAGE);

          const estimatedCost = calculateEstimatedCost(
            newTargetVal,
            meter.tariff_group?.price_schemes,
          );

          operations.push(
            prisma.efficiencyTarget.create({
              data: {
                kpi_name: `Target Efisiensi - ${periodStart.toISOString().split('T')[0]}`,
                target_value: new Prisma.Decimal(newTargetVal),
                target_cost: estimatedCost,
                period_start: periodStart,
                period_end: periodEnd,
                meter_id: meter.meter_id,
                set_by_user_id: systemAdmin.user_id,
              },
            }),
          );
        }

        if (operations.length > 0) {
          await prisma.$transaction(operations);
        }

        const duration = (new Date().getTime() - jobStart.getTime()) / 1000;
        const successMsg = `Sukses membuat ${operations.length} target efisiensi. Durasi: ${duration}s`;

        const admins = await prisma.user.findMany({
          where: { role: { role_name: { in: [RoleName.Admin, RoleName.SuperAdmin] } } },
          select: { user_id: true },
        });

        await Promise.all([
          ...admins.map((admin) =>
            notificationService.create({
              user_id: admin.user_id,
              title: 'Target Efisiensi Bulanan Siap',
              message: `Target periode ${periodStart.toLocaleDateString()} telah dibuat otomatis.`,
            }),
          ),

          alertService.create({
            title: 'Laporan Kinerja: Cron Target Efisiensi',
            description: successMsg,
          }),
        ]);

        console.log(`[EfficiencyCron] Selesai. ${successMsg}`);
      } catch (error) {
        console.error('[EfficiencyCron] Gagal:', error);

        await alertService.create({
          title: 'CRITICAL: Cron Target Gagal',
          description: `Error: ${(error as Error).message}`,
        });
      }
    },
    { timezone: 'Asia/Jakarta' },
  );
}
