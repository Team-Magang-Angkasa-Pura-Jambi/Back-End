import { type BudgetAllocation, Prisma } from '../../generated/prisma/index.js';
import prisma from '../../configs/db.js';
import { BaseService } from '../../utils/baseService.js';
import { Error404 } from '../../utils/customError.js';
import { type Decimal } from '@prisma/client/runtime/library';

export class BudgetService extends BaseService {
  constructor() {
    super(prisma);
  }

  /**
   * Menganalisis anggaran tahunan, menghitung realisasi, dan membuat/memperbarui
   * target efisiensi untuk sisa periode.
   * @param year - Tahun anggaran yang akan dianalisis.
   * @param pjjRate - Rate Pajak Penerangan Jalan (e.g., 0.09 untuk 9%).
   */
  public async processAnnualBudgetAndSetTargets(pjjRate: number, processDate?: Date): Promise<any> {
    return this._handleCrudOperation(async () => {
      const referenceDate = processDate
        ? new Date(
            Date.UTC(
              processDate.getUTCFullYear(),
              processDate.getUTCMonth(),
              processDate.getUTCDate(),
            ),
          )
        : new Date(
            Date.UTC(
              new Date().getUTCFullYear(),
              new Date().getUTCMonth(),
              new Date().getUTCDate(),
            ),
          );

      const activeBudget = await prisma.annualBudget.findFirst({
        where: {
          period_start: { lte: referenceDate },
          period_end: { gte: referenceDate },

          energy_type: {
            type_name: 'Electricity',
          },
        },

        include: {
          allocations: { include: { meter: true } },
        },
      });

      if (!activeBudget) {
        throw new Error404(`Tidak ada periode anggaran aktif yang ditemukan untuk hari ini.`);
      }

      const {
        period_start: budgetPeriodStart,
        period_end: budgetPeriodEnd,
        total_budget: periodBudget,
        efficiency_tag: efficiencyTarget,
      } = activeBudget;

      const realizationEndDate = new Date(referenceDate);
      realizationEndDate.setUTCDate(realizationEndDate.getUTCDate() - 1);

      const historicalConsumptionResult = await prisma.dailySummary.aggregate({
        _sum: {
          total_consumption: true,
        },
        where: {
          summary_date: { gte: budgetPeriodStart, lte: realizationEndDate },
          meter: { energy_type: { type_name: 'Electricity' } },
        },
      });

      const realizationResult = await prisma.dailySummary.aggregate({
        _sum: {
          total_cost: true,
        },
        where: {
          summary_date: { gte: budgetPeriodStart, lte: realizationEndDate },
          meter: {
            energy_type: { type_name: 'Electricity' },
          },
        },
      });
      const realizationCost = realizationResult._sum.total_cost ?? new Prisma.Decimal(0);
      const historicalConsumption =
        historicalConsumptionResult._sum.total_consumption ?? new Prisma.Decimal(0);

      const target95 = periodBudget.times(efficiencyTarget ?? 0);

      const remainingBudgetWithPjj = target95.minus(realizationCost);

      const remainingBudgetNet = remainingBudgetWithPjj.div(1 + pjjRate);

      const targetStartDate = referenceDate;
      const targetEndDate = budgetPeriodEnd;

      const remainingDays =
        (targetEndDate.getTime() - targetStartDate.getTime()) / (1000 * 60 * 60 * 24) + 1;

      if (remainingDays <= 0) {
        console.log('Periode anggaran telah berakhir. Tidak ada target baru yang dibuat.');
        return { message: 'Periode anggaran telah berakhir.' };
      }

      const newDailyTargetCost = remainingBudgetNet.div(remainingDays);

      const avgPricePerKwh = historicalConsumption.isZero()
        ? new Prisma.Decimal(0)
        : realizationCost.div(historicalConsumption);

      const newDailyTargetKwh = avgPricePerKwh.isZero()
        ? new Prisma.Decimal(0)
        : newDailyTargetCost.div(avgPricePerKwh);

      const allocations = activeBudget.allocations;
      if (allocations.length === 0) {
        throw new Error404(
          `Anggaran aktif ditemukan, tetapi tidak ada alokasi ke meteran manapun.`,
        );
      }

      const totalWeight = allocations.reduce(
        (sum: Decimal, alloc: BudgetAllocation) => sum.plus(alloc.weight),
        new Prisma.Decimal(0),
      );
      if (Math.abs(totalWeight.toNumber() - 1) > 0.001) {
        console.warn(
          `[BudgetService] Peringatan: Total bobot alokasi untuk budget ID ${activeBudget.budget_id} adalah ${totalWeight.toFixed(4)}, bukan 1.`,
        );
      }

      await prisma.efficiencyTarget.deleteMany({
        where: {
          meter_id: {
            in: allocations.map((alloc: BudgetAllocation) => alloc.meter_id),
          },
          kpi_name: { contains: 'Target Biaya Harian Otomatis' },

          period_start: {
            gte: new Date(
              Date.UTC(
                referenceDate.getUTCFullYear(),
                referenceDate.getUTCMonth(),
                referenceDate.getUTCDate(),
              ),
            ),
          },
        },
      });

      const budgetYear = budgetPeriodStart.getUTCFullYear();
      const createPromises = allocations.map((alloc: BudgetAllocation) => {
        const dailyTargetPerMeter = newDailyTargetCost.times(alloc.weight);
        const dailyKwhTargetPerMeter = newDailyTargetKwh.times(alloc.weight);

        return prisma.efficiencyTarget.create({
          data: {
            meter_id: alloc.meter_id,
            kpi_name: `Target Biaya Harian Otomatis - ${budgetYear}`,
            target_value: dailyKwhTargetPerMeter,
            target_cost: dailyTargetPerMeter,
            period_start: targetStartDate,
            period_end: targetEndDate,
            set_by_user_id: 1,
          },
        });
      });

      await Promise.all(createPromises);

      return {
        message: `Target efisiensi berhasil diperbarui untuk ${allocations.length} meter berdasarkan alokasi bobot.`,
        calculationDetails: {
          periodBudget: periodBudget.toFixed(2),
          target95: target95.toFixed(2),
          realizationCost: realizationCost.toFixed(2),
          remainingBudgetNet: remainingBudgetNet.toFixed(2),
          remainingDays,
        },
      };
    });
  }
}

export const budgetService = new BudgetService();
