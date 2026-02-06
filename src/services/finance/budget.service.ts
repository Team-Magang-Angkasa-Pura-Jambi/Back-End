import { Prisma } from '../../generated/prisma/index.js';
import prisma from '../../configs/db.js';
import { BaseService } from '../../utils/baseService.js';
import { Error400, Error404 } from '../../utils/customError.js';

interface MonthlyBudgetAllocation {
  month: number;
  monthName: string;
  allocatedBudget: number;
  realizationCost: number;
  remainingBudget: number;
  realizationPercentage: number | null;
}

export class BudgetService extends BaseService {
  constructor() {
    super(prisma);
  }

  public async getBudgetAllocationPreview(budgetData: {
    parent_budget_id: number;
    period_start: Date;
    period_end: Date;
    allocations?: { meter_id: number; weight: number }[];
  }): Promise<any> {
    const { parent_budget_id, period_start, period_end, allocations } = budgetData;

    const parentBudget = await prisma.annualBudget.findUnique({
      where: { budget_id: parent_budget_id },
      include: {
        energy_type: true,
        child_budgets: {
          include: { allocations: true },
        },
      },
    });

    if (!parentBudget) {
      throw new Error404(`Anggaran induk dengan ID ${parent_budget_id} tidak ditemukan.`);
    }

    const availableMeters = await prisma.meter.findMany({
      where: {
        energy_type_id: parentBudget.energy_type_id,
        status: 'Active',
      },
      select: { meter_id: true, meter_code: true },
    });

    const efficiencyTag = parentBudget.efficiency_tag
      ? new Prisma.Decimal(parentBudget.efficiency_tag)
      : new Prisma.Decimal(1);
    const efficiencyBudget = parentBudget.total_budget.times(efficiencyTag);

    const diffMonths =
      (period_end.getUTCFullYear() - period_start.getUTCFullYear()) * 12 +
      (period_end.getUTCMonth() - period_start.getUTCMonth()) +
      1;

    if (diffMonths <= 0) throw new Error400('Periode tidak valid.');

    const meterIdsInParent = new Set<number>();
    parentBudget.child_budgets.forEach((child) => {
      child.allocations.forEach((a) => meterIdsInParent.add(a.meter_id));
    });

    let realizationToDate = new Prisma.Decimal(0);
    if (meterIdsInParent.size > 0) {
      const aggregate = await prisma.dailySummary.aggregate({
        _sum: { total_cost: true },
        where: {
          meter_id: { in: Array.from(meterIdsInParent) },
          summary_date: {
            gte: parentBudget.period_start,
            lt: period_start,
          },
        },
      });
      realizationToDate = aggregate._sum.total_cost ?? new Prisma.Decimal(0);
    }

    const monthlyBase = parentBudget.total_budget.div(12);
    let suggestedBudgetForPeriod = monthlyBase.times(diffMonths).times(efficiencyTag);

    const remainingYearlyBudget = efficiencyBudget.minus(realizationToDate);
    if (suggestedBudgetForPeriod.gt(remainingYearlyBudget)) {
      suggestedBudgetForPeriod = remainingYearlyBudget;
    }

    const budgetPerMonth = suggestedBudgetForPeriod.div(diffMonths);

    const meterAllocationPreview = [];
    if (allocations && allocations.length > 0) {
      const periodDays =
        Math.ceil((period_end.getTime() - period_start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      for (const alloc of allocations) {
        const meterInfo = availableMeters.find((m) => m.meter_id === alloc.meter_id);
        const allocatedAmount = suggestedBudgetForPeriod.times(new Prisma.Decimal(alloc.weight));

        meterAllocationPreview.push({
          meterId: alloc.meter_id,
          meterName: meterInfo?.meter_code ?? `Meter ${alloc.meter_id}`,
          allocatedBudget: allocatedAmount.toNumber(),
          dailyBudgetAllocation: allocatedAmount.div(periodDays).toNumber(),
          weight: alloc.weight,
        });
      }
    }

    return {
      monthlyAllocation: Array.from({ length: diffMonths }).map((_, i) => {
        const d = new Date(period_start);
        d.setUTCMonth(d.getUTCMonth() + i);
        return {
          month: d.getUTCMonth() + 1,
          allocatedBudget: budgetPerMonth.toNumber(),
        };
      }),
      meterAllocationPreview,
      availableMeters,
      calculationDetails: {
        parentTotalBudget: parentBudget.total_budget.toNumber(),
        efficiencyBudget: efficiencyBudget.toNumber(),
        realizationToDate: realizationToDate.toNumber(),
        remainingBudgetForPeriod: remainingYearlyBudget.toNumber(),
        budgetPerMonth: budgetPerMonth.toNumber(),
        suggestedBudgetForPeriod: suggestedBudgetForPeriod.toNumber(),
        periodMonths: diffMonths,
      },
    };
  }

  public async getBudgetSummary(year: number) {
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    const parentBudgets = await prisma.annualBudget.findMany({
      where: {
        parent_budget_id: null,
        period_start: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        energy_type: true,
        child_budgets: {
          include: {
            allocations: {
              select: { meter_id: true },
            },
          },
        },
      },
    });

    const allMeterIds = new Set<number>();
    parentBudgets.forEach((budget) => {
      budget.child_budgets.forEach((child) => {
        child.allocations.forEach((alloc) => {
          if (alloc.meter_id) allMeterIds.add(alloc.meter_id);
        });
      });
    });

    const rawRealisations = await prisma.dailySummary.groupBy({
      by: ['meter_id'],
      _sum: { total_cost: true },
      where: {
        meter_id: { in: Array.from(allMeterIds) },
        summary_date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const meterCostMap = new Map<number, number>();
    rawRealisations.forEach((r) => {
      meterCostMap.set(r.meter_id, r._sum.total_cost?.toNumber() ?? 0);
    });

    const results = parentBudgets.map((budget) => {
      const totalBudget = budget.total_budget.toNumber();

      let totalRealization = 0;

      const budgetMeterIds = new Set<number>();
      budget.child_budgets.forEach((child) => {
        child.allocations.forEach((alloc) => {
          if (alloc.meter_id) budgetMeterIds.add(alloc.meter_id);
        });
      });

      budgetMeterIds.forEach((meterId) => {
        totalRealization += meterCostMap.get(meterId) ?? 0;
      });

      const remainingBudget = totalBudget - totalRealization;

      const realizationPercentage = totalBudget > 0 ? (totalRealization / totalBudget) * 100 : 0;

      let status: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';
      if (realizationPercentage >= 100) status = 'DANGER';
      else if (realizationPercentage >= 80) status = 'WARNING';

      return {
        energyTypeName: budget.energy_type.type_name,
        energyTypeId: budget.energy_type_id,
        currentPeriod: {
          periodStart: budget.period_start,
          periodEnd: budget.period_end,
          totalBudget: totalBudget,
          totalRealization: totalRealization,
          remainingBudget: remainingBudget,
          realizationPercentage: parseFloat(realizationPercentage.toFixed(2)),
          status: status,
        },
      };
    });

    return results;
  }

  public async prepareNextPeriodBudget(parentBudgetId: number) {
    return this._handleCrudOperation(async () => {
      const parentBudget = await prisma.annualBudget.findUniqueOrThrow({
        where: { budget_id: parentBudgetId },
        include: {
          child_budgets: {
            include: {
              allocations: {
                select: { meter_id: true },
              },
            },
          },
        },
      });

      if (parentBudget.parent_budget_id !== null) {
        throw new Error400('Anggaran yang diberikan bukan merupakan anggaran induk (tahunan).');
      }

      let totalRealizationCost = new Prisma.Decimal(0);
      for (const child of parentBudget.child_budgets as Prisma.AnnualBudgetGetPayload<{
        include: { allocations: { select: { meter_id: true } } };
      }>[]) {
        const childMeterIds = child.allocations.map((alloc) => alloc.meter_id);
        if (childMeterIds.length > 0) {
          const realizationResult = await prisma.dailySummary.aggregate({
            _sum: { total_cost: true },
            where: {
              meter_id: { in: childMeterIds },

              summary_date: {
                gte: child.period_start,
                lte: child.period_end,
              },
            },
          });
          totalRealizationCost = totalRealizationCost.plus(
            realizationResult._sum.total_cost ?? new Prisma.Decimal(0),
          );
        }
      }

      const availableBudgetForNextPeriod = parentBudget.total_budget.minus(totalRealizationCost);

      return {
        parentBudgetId: parentBudget.budget_id,
        parentTotalBudget: parentBudget.total_budget.toNumber(),
        totalRealizationCost: totalRealizationCost.toNumber(),
        availableBudgetForNextPeriod: availableBudgetForNextPeriod.toNumber(),
      };
    });
  }
}

export const budgetService = new BudgetService();
