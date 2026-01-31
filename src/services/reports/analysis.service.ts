import prisma from '../../configs/db.js';
import { Prisma, type UsageCategory } from '../../generated/prisma/index.js';
import type { GetAnalysisQuery } from '../../types/reports/analysis.types.js';
import { Error400, Error404 } from '../../utils/customError.js';
import { BaseService } from '../../utils/baseService.js';
import { differenceInDays } from 'date-fns';

export type ClassificationSummary = Partial<Record<UsageCategory, number>> & {
  totalDaysInMonth: number;
  totalDaysWithData: number;
  totalDaysWithClassification: number;
};

interface MonthlyBudgetAllocation {
  month: number;
  monthName: string;
  allocatedBudget: number;
  realizationCost: number;
  remainingBudget: number;
  realizationPercentage: number | null;
}

interface FuelStockSummaryRecord {
  meterId: number;
  meterName: string;
  remaining_stock: number | null;
  percentage: number | null;
  tank_volume: number | null;
  last_reading_date: Date | null;
}

export interface NewDataCountNotification {
  summary_id: number;
  summary_date: Date;
  total_consumption: number;
  total_cost: number;
  meter_code: string;
  type_name: 'Electricity' | 'Water' | 'Fuel';
  unit_of_measurement: string;
  classification: string | null;
}

export interface TodaySummaryResponse {
  meta: {
    date: Date;
    pax: number | null;
  };
  sumaries: NewDataCountNotification[];
}

export class AnalysisService extends BaseService {
  constructor() {
    super(prisma);
  }

  /**
   * BARU: Menganalisis sisa stok BBM harian untuk semua meter BBM dalam satu bulan.
   * @param query - Berisi bulan yang akan dianalisis (format YYYY-MM).
   */
  public async getMonthlyFuelStockAnalysis(
    query: Pick<GetAnalysisQuery, 'month'>,
  ): Promise<FuelStockSummaryRecord[]> {
    const { month: monthString } = query;

    const [year, month] = monthString.split('-').map(Number);
    const monthIndex = month - 1;
    const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

    const fuelMeters = await prisma.meter.findMany({
      where: {
        energy_type: { type_name: 'Fuel' },
        status: 'Active',
      },
      select: {
        meter_id: true,
        meter_code: true,
        tank_volume_liters: true,
      },
    });

    if (fuelMeters.length === 0) {
      return [];
    }

    const summaryPromises = fuelMeters.map(async (meter) => {
      const lastReading = await prisma.summaryDetail.findFirst({
        where: {
          summary: {
            meter_id: meter.meter_id,
            summary_date: { lte: endDate },
          },
          remaining_stock: { not: null },
        },
        orderBy: { summary: { summary_date: 'desc' } },
        select: {
          remaining_stock: true,
          summary: { select: { summary_date: true } },
        },
      });

      const remainingStock = lastReading?.remaining_stock?.toNumber() ?? null;
      const tankVolume = meter.tank_volume_liters?.toNumber() ?? null;
      let percentage: number | null = null;

      if (remainingStock !== null && tankVolume !== null && tankVolume > 0) {
        percentage = parseFloat(((remainingStock / tankVolume) * 100).toFixed(2));
      }

      return {
        meterId: meter.meter_id,
        meterName: meter.meter_code,
        remaining_stock: remainingStock,
        percentage: percentage,
        tank_volume: tankVolume,
        last_reading_date: lastReading?.summary.summary_date ?? null,
      };
    });

    return Promise.all(summaryPromises);
  }

  public async getTodaySummary(
    energyType?: 'Electricity' | 'Water' | 'Fuel',
  ): Promise<TodaySummaryResponse> {
    const todayInJakarta = new Date();

    const dateString = todayInJakarta.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Jakarta',
    });

    const today = new Date(dateString);

    const whereClause: Prisma.DailySummaryWhereInput = {
      summary_date: today,
    };

    if (energyType) {
      whereClause.meter = {
        energy_type: {
          type_name: energyType,
        },
      };
    }

    const [todaySummaries, paxData] = await Promise.all([
      prisma.dailySummary.findMany({
        where: whereClause,
        include: {
          meter: {
            select: {
              meter_code: true,
              energy_type: {
                select: { type_name: true, unit_of_measurement: true },
              },
            },
          },
          classification: { select: { classification: true } },
        },
        orderBy: { meter: { energy_type: { type_name: 'asc' } } },
      }),
      prisma.paxData.findUnique({
        where: { data_date: today },
      }),
    ]);

    const formattedData: NewDataCountNotification[] = todaySummaries.map((item) => {
      return {
        summary_id: item.summary_id,

        summary_date: item.summary_date,

        total_consumption: item.total_consumption?.toNumber() ?? 0,
        total_cost: item.total_cost?.toNumber() ?? 0,

        meter_code: item.meter.meter_code,

        type_name: item.meter.energy_type.type_name as 'Electricity' | 'Water' | 'Fuel',
        unit_of_measurement: item.meter.energy_type.unit_of_measurement,

        classification: item.classification?.classification ?? null,
      };
    });

    return {
      meta: {
        date: today,
        pax: paxData?.total_pax ?? null,
      },
      sumaries: formattedData,
    };
  }

  /**
   * BARU: Menghitung alokasi anggaran tahunan dan membandingkannya dengan realisasi bulanan.
   * @param year - Tahun yang akan dianalisis.
   */
  public async getBudgetAllocation(year: number): Promise<MonthlyBudgetAllocation[]> {
    const yearStartDate = new Date(Date.UTC(year, 0, 1));
    const yearEndDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const budgetPeriods = await prisma.annualBudget.findMany({
      where: {
        OR: [
          {
            period_start: { lte: yearEndDate },
            period_end: { gte: yearStartDate },
          },
        ],
      },
    });

    if (budgetPeriods.length === 0) {
      throw new Error404(`Tidak ada data anggaran yang ditemukan untuk tahun ${year}.`);
    }

    const monthlyAllocations: MonthlyBudgetAllocation[] = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(Date.UTC(year, i, 1)).toLocaleString('id-ID', {
        month: 'long',
      }),
      allocatedBudget: 0,
      realizationCost: 0,
      remainingBudget: 0,
      realizationPercentage: 0,
    }));

    for (const budget of budgetPeriods) {
      const periodDays =
        (budget.period_end.getTime() - budget.period_start.getTime()) / (1000 * 60 * 60 * 24) + 1;
      if (periodDays <= 0) continue;

      const budgetPerDay = budget.total_budget.dividedBy(periodDays);

      for (let i = 0; i < 12; i++) {
        const monthStartDate = new Date(Date.UTC(year, i, 1));
        const monthEndDate = new Date(Date.UTC(year, i + 1, 0));

        const overlapStart = new Date(
          Math.max(monthStartDate.getTime(), budget.period_start.getTime()),
        );
        const overlapEnd = new Date(Math.min(monthEndDate.getTime(), budget.period_end.getTime()));

        if (overlapEnd >= overlapStart) {
          const daysInMonthOverlap =
            (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
          const budgetForMonth = budgetPerDay.times(daysInMonthOverlap);
          monthlyAllocations[i].allocatedBudget += budgetForMonth.toNumber();
        }
      }
    }

    const realizationResult = await prisma.$queryRaw<{ month: number; total_cost: number }[]>(
      Prisma.sql`
      SELECT
        EXTRACT(MONTH FROM summary_date) as month,
        SUM(total_cost) as total_cost
      FROM "daily_summaries"
      WHERE EXTRACT(YEAR FROM summary_date) = ${year}
        AND meter_id IN (
          SELECT meter_id FROM meters WHERE energy_type_id IN (SELECT DISTINCT energy_type_id FROM "annual_budgets" WHERE EXTRACT(YEAR FROM period_start) = ${year} OR EXTRACT(YEAR FROM period_end) = ${year})
        )
      GROUP BY month
      ORDER BY month;
    `,
    );

    for (const realization of realizationResult) {
      const monthIndex = realization.month - 1;
      if (monthlyAllocations[monthIndex]) {
        monthlyAllocations[monthIndex].realizationCost = Number(realization.total_cost);
      }
    }

    for (const allocation of monthlyAllocations) {
      allocation.remainingBudget = allocation.allocatedBudget - allocation.realizationCost;
      if (allocation.allocatedBudget > 0) {
        allocation.realizationPercentage = parseFloat(
          ((allocation.realizationCost / allocation.allocatedBudget) * 100).toFixed(2),
        );
      } else {
        allocation.realizationPercentage = null;
      }
    }

    return monthlyAllocations;
  }

  /**
   * BARU: Menghitung pratinjau alokasi anggaran bulanan dari data yang belum disimpan.
   * @param budgetData - Data anggaran sementara dari input pengguna.
   */
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

  public async getEfficiencyTargetPreview(data: {
    target_value: number;
    meterId: number;
    periodStartDate: Date;
    periodEndDate: Date;
  }) {
    return this._handleCrudOperation(async () => {
      const { target_value, meterId, periodStartDate, periodEndDate } = data;

      if (periodEndDate < periodStartDate) {
        throw new Error400('Tanggal akhir tidak boleh sebelum tanggal mulai.');
      }
      const totalDays = differenceInDays(periodEndDate, periodStartDate) + 1;
      if (totalDays <= 0) {
        throw new Error400('Periode tidak valid, tanggal akhir harus setelah tanggal mulai.');
      }

      const meter = await prisma.meter.findUnique({
        where: { meter_id: meterId },
        include: {
          energy_type: true,
          tariff_group: {
            include: {
              price_schemes: {
                where: { is_active: true },
                include: { rates: { include: { reading_type: true } } },
                orderBy: { effective_date: 'desc' },
              },
            },
          },
        },
      });

      if (!meter) {
        throw new Error404(`Meter dengan ID ${meterId} tidak ditemukan.`);
      }

      const activePriceScheme = meter.tariff_group?.price_schemes[0];
      if (!activePriceScheme) {
        throw new Error404(
          `Tidak ada skema harga aktif yang ditemukan untuk golongan tarif meter '${meter.meter_code}'.`,
        );
      }

      let avgPricePerUnit: Prisma.Decimal;
      if (meter.energy_type.type_name === 'Electricity') {
        const wbpRate = activePriceScheme.rates.find(
          (r: any) => r.reading_type.type_name === 'WBP',
        )?.value;
        const lwbpRate = activePriceScheme.rates.find(
          (r: any) => r.reading_type.type_name === 'LWBP',
        )?.value;

        if (!wbpRate || !lwbpRate) {
          throw new Error400(
            'Skema harga untuk Listrik tidak lengkap. Tarif WBP atau LWBP tidak ditemukan.',
          );
        }

        avgPricePerUnit = wbpRate.plus(lwbpRate).div(2);
      } else {
        const singleRate = activePriceScheme.rates[0]?.value;
        if (!singleRate) {
          throw new Error400(
            `Skema harga untuk ${meter.energy_type.type_name} tidak memiliki tarif yang terdefinisi.`,
          );
        }
        avgPricePerUnit = singleRate;
      }

      if (avgPricePerUnit.isZero()) {
        throw new Error400(
          'Harga rata-rata per unit adalah nol. Tidak dapat menghitung target dari anggaran.',
        );
      }

      const inputTotalKwh = new Prisma.Decimal(target_value).times(totalDays);
      const estimatedTotalCost = inputTotalKwh.times(avgPricePerUnit);

      const budgetAllocation = await prisma.budgetAllocation.findFirst({
        where: {
          meter_id: meterId,
          budget: {
            parent_budget_id: { not: null },
            period_start: { lte: periodEndDate },
            period_end: { gte: periodStartDate },
          },
        },
        include: { budget: { include: { parent_budget: true } } },
      });

      let budgetInfo: object | null = null;
      let suggestion: object | null = null;

      if (budgetAllocation) {
        const allocatedBudgetForMeter = budgetAllocation.budget.total_budget.times(
          budgetAllocation.weight,
        );

        budgetInfo = {
          budgetId: budgetAllocation.budget_id,
          budgetPeriodStart: budgetAllocation.budget.period_start,
          budgetPeriodEnd: budgetAllocation.budget.period_end,
          meterAllocationWeight: budgetAllocation.weight.toNumber(),
          allocatedBudgetForMeter: allocatedBudgetForMeter.toNumber(),

          realizationToDate: 0,
          remainingBudget: allocatedBudgetForMeter.toNumber(),
        };

        const realizationEndDate = new Date(periodStartDate);
        realizationEndDate.setUTCDate(realizationEndDate.getUTCDate() - 1);

        let remainingBudget = allocatedBudgetForMeter;
        let realizedCost = new Prisma.Decimal(0);

        if (realizationEndDate >= budgetAllocation.budget.period_start) {
          const realizationResult = await prisma.dailySummary.aggregate({
            _sum: { total_cost: true },
            where: {
              meter_id: meterId,
              summary_date: {
                gte: budgetAllocation.budget.period_start,
                lte: realizationEndDate,
              },
            },
          });

          realizedCost = realizationResult._sum.total_cost ?? new Prisma.Decimal(0);
          remainingBudget = allocatedBudgetForMeter.minus(realizedCost);

          (budgetInfo as any).realizationToDate = realizedCost.toNumber();
          (budgetInfo as any).remainingBudget = remainingBudget.toNumber();
        }

        const childBudget = budgetAllocation.budget;
        const childPeriodDays =
          differenceInDays(childBudget.period_end, childBudget.period_start) + 1;

        const childPeriodMonths =
          (childBudget.period_end.getUTCFullYear() - childBudget.period_start.getUTCFullYear()) *
            12 +
          (childBudget.period_end.getUTCMonth() - childBudget.period_start.getUTCMonth()) +
          1;

        const dailyBudgetForMeter = allocatedBudgetForMeter.div(childPeriodDays);

        const suggestedDailyKwh = dailyBudgetForMeter.div(avgPricePerUnit);

        suggestion = {
          standard: {
            message: `Berdasarkan alokasi anggaran periode ini, target harian Anda adalah sekitar ${suggestedDailyKwh.toDP(2).toString()} ${meter.energy_type.unit_of_measurement}.`,
            suggestedDailyKwh: suggestedDailyKwh.toNumber(),
            suggestedTotalKwh: suggestedDailyKwh.times(totalDays).toNumber(),
          },
        };
      }

      return {
        input: {
          ...data,
        },
        budget: budgetInfo,
        preview: {
          totalDays,
          unitOfMeasurement: meter.energy_type.unit_of_measurement,
          avgPricePerUnit: avgPricePerUnit.toNumber(),
          inputTotalKwh: inputTotalKwh.toNumber(),
          estimatedTotalCost: estimatedTotalCost.toNumber(),
        },
        suggestion,
      };
    });
  }
}
