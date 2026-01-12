import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../configs/db.js';
import { type UsageCategory } from '../../generated/prisma/index.js';
import { Error400, Error404 } from '../../utils/customError.js';

export interface MeterRankInsightType {
  percentage_used: number;
  estimated_cost: number;
  avg_daily_consumption: number;
  trend: 'NAIK' | 'TURUN' | 'STABIL' | 'UNKNOWN';
  trend_percentage: number;
  recommendation: string;
}

export interface MeterRankType {
  code: string;
  unit_of_measurement: string;
  consumption: number;
  budget: number;
  status: string;
  insight: MeterRankInsightType;
}

export interface EnergyOutlookType {
  meter_code: string;
  est: number;
  status: UsageCategory;
  over: number;
}

export interface YearlyHeatmapType {
  classification_date: Date;
  classification: UsageCategory;
  confidence_score?: number | null;
}

export interface BudgetTrackingType {
  year: string;
  energyType: string;
  initial: number;
  used: number[];
  saved: number[];
}

export interface YearlyAnalysisType {
  month: string;
  consumption: number;
  cost: number;
  budget: number;
}

export interface YearlyAnalysisResult {
  chartData: YearlyAnalysisType[];
  summary: {
    peakMonth: string;
    peakCost: number;
    peakConsumptionMonth: string;
    peakConsumptionValue: number;
    totalAnnualBudget: number;
    totalRealizedCost: number;
    realizedSavings: number;
    isDeficit: boolean;
    overBudgetCount: number;
    budgetUtilization: number;
    avgCostYTD: number;
  };
}

export interface UnifiedEnergyComparisonType {
  category: string;
  unit: string;
  weekday_cons: number;
  holiday_cons: number;
  weekday_cost: number;
  holiday_cost: number;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ags',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export interface efficiencyRatioType {
  day: string;
  terminalRatio: Decimal;
  officeRatio: Decimal;
  pax: number;
}

export interface DailyAveragePaxType {
  day: string;
  avgPax: number;
}

export interface BudgetBurnRateType {
  dayDate: number;
  actual: number | null;
  idea: number;
  efficent: number;
}

export interface getFuelRefillAnalysisType {
  month: string;
  refill: number;
  remainingStock: number;
  consumption: number;
}

export interface GetAnalysisQuery {
  energyType: string;
  month: string;
  meterId?: number;
}

export interface DailyAnalysisRecord {
  date: Date;
  actual_consumption: number | null;
  consumption_cost: number | null;
  prediction: number | null;
  classification: UsageCategory | null;
  confidence_score: Decimal | null;
  efficiency_target: number | null;
  efficiency_target_cost: number | null;
}

export interface MeterAnalysisData {
  meterId: number;
  meterName: string;
  data: DailyAnalysisRecord[];
}

export const MeterRankService = async (): Promise<MeterRankType[]> => {
  try {
    const now = new Date();

    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const daysPassedCurrentMonth = now.getDate();

    const data = await prisma.meter.findMany({
      where: { status: 'Active' },
      select: {
        meter_code: true,
        energy_type: {
          select: {
            type_name: true,
            unit_of_measurement: true,
            reading_types: {
              select: { rates: { select: { value: true } } },
            },
          },
        },

        daily_summaries: {
          where: {
            summary_date: {
              gte: startOfPrevMonth,
              lte: endOfCurrentMonth,
            },
          },
          select: {
            summary_date: true,
            total_consumption: true,
            classification: { select: { classification: true } },
          },
          orderBy: { summary_date: 'desc' },
        },
        budget_allocations: {
          select: {
            weight: true,
            budget: {
              select: {
                total_budget: true,
                period_start: true,
                period_end: true,
              },
            },
          },
          orderBy: { budget: { period_start: 'desc' } },
          take: 1,
        },
      },
    });

    const result: MeterRankType[] = data.map((meter) => {
      const allRates =
        meter.energy_type?.reading_types.flatMap((rt) =>
          rt.rates.map((r) => new Decimal(r.value).toNumber()),
        ) ?? [];

      const specificAvgRate =
        allRates.length > 0
          ? allRates.reduce((acc, curr) => acc + curr, 0) / allRates.length
          : 1500;

      const currentMonthSummaries = meter.daily_summaries.filter(
        (s) => new Date(s.summary_date) >= startOfCurrentMonth,
      );

      const prevMonthSummaries = meter.daily_summaries.filter(
        (s) =>
          new Date(s.summary_date) >= startOfPrevMonth &&
          new Date(s.summary_date) < startOfCurrentMonth,
      );

      const consumptionCurrent = currentMonthSummaries.reduce(
        (acc, curr) => acc + new Decimal(curr.total_consumption ?? 0).toNumber(),
        0,
      );

      const consumptionPrev = prevMonthSummaries.reduce(
        (acc, curr) => acc + new Decimal(curr.total_consumption ?? 0).toNumber(),
        0,
      );

      const latestStatus = currentMonthSummaries[0]?.classification?.classification ?? 'UNKNOWN';
      const allocation = meter.budget_allocations[0];
      const budgetParent = allocation?.budget;
      let budgetInUnit = 0;

      if (budgetParent && allocation.weight) {
        const start = new Date(budgetParent.period_start);
        const end = new Date(budgetParent.period_end);

        const monthDuration =
          (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;

        const totalBudgetInRp = new Decimal(budgetParent.total_budget).toNumber();
        const monthlyBudgetParent = totalBudgetInRp / (monthDuration ?? 1);
        const meterMonthlyBudgetRp =
          monthlyBudgetParent * new Decimal(allocation.weight).toNumber();

        budgetInUnit = meterMonthlyBudgetRp / specificAvgRate;
      }

      const estimatedCost = consumptionCurrent * specificAvgRate;

      const percentageUsed = budgetInUnit > 0 ? (consumptionCurrent / budgetInUnit) * 100 : 0;

      const currentADC = consumptionCurrent / (daysPassedCurrentMonth ?? 1);

      const daysInPrevMonth =
        prevMonthSummaries.length ?? new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      const prevADC = consumptionPrev / (daysInPrevMonth ?? 1);

      let trend: 'NAIK' | 'TURUN' | 'STABIL' | 'UNKNOWN' = 'STABIL';
      let trendDiffPercent = 0;

      if (prevADC > 0) {
        trendDiffPercent = ((currentADC - prevADC) / prevADC) * 100;
        if (trendDiffPercent > 5) trend = 'NAIK';
        else if (trendDiffPercent < -5) trend = 'TURUN';
      } else if (currentADC > 0) {
        trend = 'NAIK';
        trendDiffPercent = 100;
      } else {
        trend = 'UNKNOWN';
      }

      let recommendation = 'Pemakaian normal.';
      if (percentageUsed > 100) recommendation = 'Over Budget! Segera lakukan efisiensi.';
      else if (percentageUsed > 80) recommendation = 'Hati-hati, mendekati batas anggaran.';
      else if (trend === 'NAIK' && percentageUsed > 50)
        recommendation = 'Tren naik signifikan, cek potensi kebocoran.';
      else if (trend === 'TURUN') recommendation = 'Efisiensi berjalan baik.';

      return {
        code: meter.meter_code,
        unit_of_measurement: meter.energy_type?.unit_of_measurement ?? 'UNKNOWN',
        consumption: Number(consumptionCurrent.toFixed(2)),
        budget: Math.round(budgetInUnit),
        status: latestStatus as string,
        insight: {
          percentage_used: Number(percentageUsed.toFixed(1)),
          estimated_cost: Math.round(estimatedCost),
          avg_daily_consumption: Number(currentADC.toFixed(2)),
          trend,
          trend_percentage: Number(Math.abs(trendDiffPercent).toFixed(1)),
          recommendation,
        },
      };
    });

    return result.sort((a, b) => {
      const ratioA = a.budget > 0 ? a.consumption / a.budget : 0;
      const ratioB = b.budget > 0 ? b.consumption / b.budget : 0;
      return ratioB - ratioA;
    });
  } catch (error) {
    console.error('Error in MeterRankService:', error);
    throw new Error400('Gagal mengambil data ranking meteran beserta insight.');
  }
};

export const EnergyOutlookService = async (): Promise<EnergyOutlookType[]> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const predictionsSummary = await prisma.consumptionPrediction.groupBy({
      by: ['meter_id'],
      where: { prediction_date: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { predicted_value: true },
    });

    const results = await Promise.all(
      predictionsSummary.map(async (p) => {
        const meterDetail = await prisma.meter.findUnique({
          where: { meter_id: p.meter_id },
          select: {
            meter_code: true,
            energy_type: {
              select: {
                reading_types: {
                  select: { rates: { select: { value: true } } },
                },
              },
            },
            budget_allocations: {
              select: {
                weight: true,
                budget: {
                  select: {
                    total_budget: true,
                    period_start: true,
                    period_end: true,
                  },
                },
              },
              take: 1,
              orderBy: { budget: { period_start: 'desc' } },
            },
            daily_summaries: {
              take: 1,
              orderBy: { summary_date: 'desc' },
              select: { classification: { select: { classification: true } } },
            },
          },
        });

        if (!meterDetail) return null;

        const allRates =
          meterDetail.energy_type?.reading_types.flatMap((rt) =>
            rt.rates.map((r) => new Decimal(r.value).toNumber()),
          ) ?? [];

        const specificAvgRate =
          allRates.length > 0
            ? allRates.reduce((acc, curr) => acc + curr, 0) / allRates.length
            : 1500;

        const totalPredictedKwh = new Decimal(p._sum.predicted_value ?? 0).toNumber();
        const estCost = totalPredictedKwh * specificAvgRate;

        let budgetKwh = 0;
        const allocation = meterDetail.budget_allocations[0];
        if (allocation?.budget) {
          const start = new Date(allocation.budget.period_start);
          const end = new Date(allocation.budget.period_end);
          const monthDuration =
            (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) ||
            1;

          const monthlyBudgetRp =
            new Decimal(allocation.budget.total_budget).toNumber() / monthDuration;
          const meterBudgetRp = monthlyBudgetRp * new Decimal(allocation.weight).toNumber();

          budgetKwh = meterBudgetRp / specificAvgRate;
        }

        const overPercentage =
          budgetKwh > 0 ? Math.round((totalPredictedKwh / budgetKwh) * 100) : 0;

        return {
          meter_code: meterDetail.meter_code,
          est: Math.round(estCost),
          status: meterDetail.daily_summaries[0]?.classification?.classification ?? 'NORMAL',
          over: overPercentage,
        };
      }),
    );

    return results.filter((item) => item !== null) as EnergyOutlookType[];
  } catch (error) {
    console.error('Error in EnergyOutlookService:', error);
    throw new Error('Gagal mengagregasi data prediksi energi.');
  }
};

export const getYearlyHeatmapService = async (
  meterId: number,
  year: number,
): Promise<YearlyHeatmapType[]> => {
  const startDate = new Date(Date.UTC(year, 0, 1));
  const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  return prisma.dailyUsageClassification.findMany({
    where: {
      meter_id: meterId,
      classification_date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      classification_date: true,
      classification: true,
      confidence_score: true,
    },
    orderBy: {
      classification_date: 'asc',
    },
  });
};
export const getBudgetTrackingService = async (): Promise<BudgetTrackingType[]> => {
  try {
    const budgets = await prisma.annualBudget.findMany({
      include: { energy_type: true },
      orderBy: { period_start: 'desc' },
    });

    const result = await Promise.all(
      budgets.map(async (budget) => {
        const year = budget.period_start.getFullYear().toString();
        const energyTypeName = budget.energy_type.type_name;
        const initialBudget = Number(budget.total_budget);

        const usageAggregates = await prisma.dailySummary.groupBy({
          by: ['summary_date'],
          _sum: { total_cost: true },
          where: {
            summary_date: {
              gte: new Date(`${year}-01-01`),
              lte: new Date(`${year}-12-31`),
            },
            meter: {
              energy_type: { type_name: energyTypeName },
            },
          },
        });

        const usedArray = new Array(12).fill(0);
        usageAggregates.forEach((record) => {
          const month = new Date(record.summary_date).getMonth();
          usedArray[month] += Number(record._sum.total_cost ?? 0);
        });

        const monthlyBudget = initialBudget / 12;
        const savedArray = usedArray.map((used) => {
          if (used === 0) return 0;
          return Math.max(0, monthlyBudget - used);
        });

        return {
          year: year,
          energyType: energyTypeName,
          initial: initialBudget,
          used: usedArray,
          saved: savedArray,
        };
      }),
    );

    return result;
  } catch (error) {
    console.error('Error in getBudgetTrackingService:', error);
    throw new Error('Gagal melacak penggunaan anggaran.');
  }
};

export const getYearlyAnalysisService = async (
  energyTypeName: string,
  year: number,
): Promise<YearlyAnalysisResult> => {
  try {
    const parentBudget = await prisma.annualBudget.findFirst({
      where: {
        parent_budget_id: null,
        energy_type: {
          type_name: energyTypeName,
        },

        period_start: { lte: new Date(`${year}-12-31`) },
        period_end: { gte: new Date(`${year}-01-01`) },
      },
      include: {
        child_budgets: true,
      },
    });

    const summaries = await prisma.dailySummary.findMany({
      where: {
        summary_date: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
        meter: {
          energy_type: {
            type_name: energyTypeName,
          },
        },
      },
      select: {
        summary_date: true,
        total_consumption: true,
        total_cost: true,
      },
    });

    const result: YearlyAnalysisType[] = [];

    for (let i = 0; i < 12; i++) {
      const monthName = MONTH_NAMES[i];

      const startOfMonth = new Date(year, i, 1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(year, i + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      let calculatedMonthlyBudget = 0;

      if (parentBudget) {
        const activeChild = parentBudget.child_budgets.find((child) => {
          const cStart = new Date(child.period_start);
          const cEnd = new Date(child.period_end);
          cStart.setHours(0, 0, 0, 0);
          cEnd.setHours(23, 59, 59, 999);

          return cStart <= endOfMonth && cEnd >= startOfMonth;
        });

        if (activeChild) {
          const cStart = new Date(activeChild.period_start);
          const cEnd = new Date(activeChild.period_end);

          const durationMonths =
            (cEnd.getFullYear() - cStart.getFullYear()) * 12 +
            (cEnd.getMonth() - cStart.getMonth()) +
            1;

          if (durationMonths > 0) {
            calculatedMonthlyBudget = Number(activeChild.total_budget) / durationMonths;
          }
        } else {
          const pStart = new Date(parentBudget.period_start);
          const pEnd = new Date(parentBudget.period_end);
          pStart.setHours(0, 0, 0, 0);
          pEnd.setHours(23, 59, 59, 999);

          if (pStart <= endOfMonth && pEnd >= startOfMonth) {
            const parentDuration =
              (pEnd.getFullYear() - pStart.getFullYear()) * 12 +
              (pEnd.getMonth() - pStart.getMonth()) +
              1;

            if (parentDuration > 0) {
              calculatedMonthlyBudget = Number(parentBudget.total_budget) / parentDuration;
            }
          }
        }
      }

      const monthlySummaries = summaries.filter((item) => {
        const d = new Date(item.summary_date);
        return d.getMonth() === i && d.getFullYear() === year;
      });

      const totalConsumption = monthlySummaries.reduce(
        (sum, item) => sum + Number(item.total_consumption),
        0,
      );
      const totalCost = monthlySummaries.reduce((sum, item) => sum + Number(item.total_cost), 0);

      result.push({
        month: monthName,
        consumption: totalConsumption,
        cost: totalCost,
        budget: calculatedMonthlyBudget,
      });
    }

    const now = new Date();
    const currentMonthIndex = now.getMonth();
    const currentYear = now.getFullYear();

    const isCurrentYear = year === currentYear;

    let peakMonthObj = result[0];
    let peakConsumptionObj = result[0];
    let overBudgetCount = 0;

    let totalAnnualBudget = 0;
    let totalRealizedBudget = 0;
    let totalRealizedCost = 0;

    const validMonthsCount = isCurrentYear ? currentMonthIndex + 1 : 12;

    result.forEach((data, index) => {
      totalAnnualBudget += data.budget;
      totalRealizedCost += data.cost;

      if (data.cost > peakMonthObj.cost) peakMonthObj = data;
      if (data.consumption > peakConsumptionObj.consumption) peakConsumptionObj = data;

      if (data.cost > data.budget && data.budget > 0) {
        overBudgetCount++;
      }

      const isPassedMonth = !isCurrentYear || (isCurrentYear && index <= currentMonthIndex);

      if (isPassedMonth) {
        totalRealizedBudget += data.budget;
      }
    });

    const realizedSavings = totalRealizedBudget - totalRealizedCost;
    const isDeficit = realizedSavings < 0;

    const budgetUtilization =
      totalRealizedBudget > 0 ? (totalRealizedCost / totalRealizedBudget) * 100 : 0;

    const avgCostYTD = totalRealizedCost / validMonthsCount;

    return {
      chartData: result,
      summary: {
        peakMonth: peakMonthObj.month,
        peakCost: peakMonthObj.cost,
        peakConsumptionMonth: peakConsumptionObj.month,
        peakConsumptionValue: peakConsumptionObj.consumption,
        totalAnnualBudget,
        totalRealizedCost,
        realizedSavings,
        isDeficit,
        overBudgetCount,
        budgetUtilization,
        avgCostYTD,
      },
    };
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Gagal menganalisis tren tahunan.');
  }
};

export const getUnifiedComparisonService = async (
  energyTypeName: string,
  year: number,
  month: number,
): Promise<UnifiedEnergyComparisonType> => {
  try {
    const startDate = new Date(year, month - 1, 1);

    const endDate = new Date(year, month, 0, 23, 59, 59);

    const summaries = await prisma.dailySummary.findMany({
      where: {
        summary_date: {
          gte: startDate,
          lte: endDate,
        },
        meter: {
          energy_type: { type_name: energyTypeName },
        },
      },
      select: {
        summary_date: true,
        total_consumption: true,
        total_cost: true,
      },
    });

    let weekdayTotalCons = 0;
    let weekdayTotalCost = 0;
    let weekdayCount = 0;

    let holidayTotalCons = 0;
    let holidayTotalCost = 0;
    let holidayCount = 0;

    const unitMap: Record<string, 'kWh' | 'm³' | 'L' | 'Unit'> = {
      Electricity: 'kWh',
      Water: 'm³',
      Fuel: 'L',
    };
    const unit = unitMap[energyTypeName] ?? 'Unit';

    for (const item of summaries) {
      const date = new Date(item.summary_date);
      const day = date.getDay();

      const isHoliday = day === 0 || day === 6;

      const cons = Number(item.total_consumption);
      const cost = Number(item.total_cost);

      if (isHoliday) {
        holidayTotalCons += cons;
        holidayTotalCost += cost;
        holidayCount++;
      } else {
        weekdayTotalCons += cons;
        weekdayTotalCost += cost;
        weekdayCount++;
      }
    }

    const avgWeekdayCons = weekdayCount > 0 ? weekdayTotalCons / weekdayCount : 0;
    const avgHolidayCons = holidayCount > 0 ? holidayTotalCons / holidayCount : 0;
    const avgWeekdayCost = weekdayCount > 0 ? weekdayTotalCost / weekdayCount : 0;
    const avgHolidayCost = holidayCount > 0 ? holidayTotalCost / holidayCount : 0;

    return {
      category: energyTypeName as any,
      unit: unit,
      weekday_cons: Math.round(avgWeekdayCons),
      holiday_cons: Math.round(avgHolidayCons),
      weekday_cost: Math.round(avgWeekdayCost),
      holiday_cost: Math.round(avgHolidayCost),
    };
  } catch (error) {
    console.error('Error in getUnifiedComparisonService:', error);
    throw new Error('Gagal membandingkan data Workday vs Holiday.');
  }
};

export const getEfficiencyRatioService = async (
  year: number,
  month: number,
): Promise<efficiencyRatioType[]> => {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const dayBuckets: Record<
      number,
      {
        name: string;
        totalPax: number;
        totalTerminal: number;
        totalOffice: number;
        occurrenceCount: number;
      }
    > = {
      0: {
        name: 'Minggu',
        totalPax: 0,
        totalTerminal: 0,
        totalOffice: 0,
        occurrenceCount: 0,
      },
      1: {
        name: 'Senin',
        totalPax: 0,
        totalTerminal: 0,
        totalOffice: 0,
        occurrenceCount: 0,
      },
      2: {
        name: 'Selasa',
        totalPax: 0,
        totalTerminal: 0,
        totalOffice: 0,
        occurrenceCount: 0,
      },
      3: {
        name: 'Rabu',
        totalPax: 0,
        totalTerminal: 0,
        totalOffice: 0,
        occurrenceCount: 0,
      },
      4: {
        name: 'Kamis',
        totalPax: 0,
        totalTerminal: 0,
        totalOffice: 0,
        occurrenceCount: 0,
      },
      5: {
        name: 'Jumat',
        totalPax: 0,
        totalTerminal: 0,
        totalOffice: 0,
        occurrenceCount: 0,
      },
      6: {
        name: 'Sabtu',
        totalPax: 0,
        totalTerminal: 0,
        totalOffice: 0,
        occurrenceCount: 0,
      },
    };

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayIndex = d.getDay();
      dayBuckets[dayIndex].occurrenceCount += 1;
    }

    const paxDataList = await prisma.paxData.findMany({
      where: { data_date: { gte: startDate, lte: endDate } },
    });

    paxDataList.forEach((p) => {
      const dayIndex = new Date(p.data_date).getDay();
      dayBuckets[dayIndex].totalPax += p.total_pax;
    });

    const summaries = await prisma.dailySummary.findMany({
      where: {
        summary_date: { gte: startDate, lte: endDate },
        meter: {
          status: 'Active',
          energy_type: {
            type_name: { contains: 'Electricity', mode: 'insensitive' },
          },
        },
      },
      include: {
        meter: { include: { category: true } },
      },
    });

    for (const item of summaries) {
      const dayIndex = new Date(item.summary_date).getDay();
      const kwh = Number(item.total_consumption);

      const categoryName = item.meter.category?.name?.toLowerCase() ?? '';
      const meterName = item.meter.meter_code.toLowerCase();
      const isOffice =
        categoryName.includes('office') ??
        meterName.includes('office') ??
        meterName.includes('kantor');

      if (isOffice) {
        dayBuckets[dayIndex].totalOffice += kwh;
      } else {
        dayBuckets[dayIndex].totalTerminal += kwh;
      }
    }

    const orderOfDay = [1, 2, 3, 4, 5, 6, 0];

    const results = orderOfDay.map((dayIndex) => {
      const bucket = dayBuckets[dayIndex];

      const terminalRatioVal = bucket.totalPax > 0 ? bucket.totalTerminal / bucket.totalPax : 0;

      const officeRatioVal =
        bucket.occurrenceCount > 0 ? bucket.totalOffice / bucket.occurrenceCount : 0;

      const avgPax =
        bucket.occurrenceCount > 0 ? Math.round(bucket.totalPax / bucket.occurrenceCount) : 0;

      return {
        day: bucket.name,
        pax: avgPax,
        terminalRatio: new Decimal(terminalRatioVal),
        officeRatio: new Decimal(officeRatioVal),
      };
    });

    return results;
  } catch (error) {
    console.error('Error in getEfficiencyRatioService:', error);
    throw new Error('Gagal menghitung profil efisiensi mingguan.');
  }
};

export const getDailyAveragePaxService = async (
  year: number,
  month: number,
): Promise<DailyAveragePaxType[]> => {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const paxDataList = await prisma.paxData.findMany({
      where: {
        data_date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        data_date: true,
        total_pax: true,
      },
    });

    const dayBuckets: Record<number, { total: number; count: number; name: string }> = {
      0: { total: 0, count: 0, name: 'Minggu' },
      1: { total: 0, count: 0, name: 'Senin' },
      2: { total: 0, count: 0, name: 'Selasa' },
      3: { total: 0, count: 0, name: 'Rabu' },
      4: { total: 0, count: 0, name: 'Kamis' },
      5: { total: 0, count: 0, name: 'Jumat' },
      6: { total: 0, count: 0, name: 'Sabtu' },
    };

    paxDataList.forEach((item) => {
      const dayIndex = new Date(item.data_date).getDay();

      if (dayBuckets[dayIndex]) {
        dayBuckets[dayIndex].total += item.total_pax;
        dayBuckets[dayIndex].count += 1;
      }
    });

    const orderOfDay = [1, 2, 3, 4, 5, 6, 0];

    const results = orderOfDay.map((dayIndex) => {
      const bucket = dayBuckets[dayIndex];

      const average = bucket.count > 0 ? bucket.total / bucket.count : 0;

      return {
        day: bucket.name,
        avgPax: Math.round(average),
      };
    });

    return results;
  } catch (error) {
    console.error('Error in getDailyAveragePaxService:', error);
    throw new Error('Gagal menghitung rata-rata penumpang harian.');
  }
};

export const getBudgetBurnRateService = async (
  year: number,
  month: number,
): Promise<BudgetBurnRateType[]> => {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const totalDaysInMonth = endDate.getDate();

    const childBudget = await prisma.annualBudget.findFirstOrThrow({
      where: {
        period_start: { lte: endDate },
        period_end: { gte: startDate },
        parent_budget_id: { not: null },
      },
      select: {
        total_budget: true,
        parent_budget_id: true,
      },
    });

    const parentBudget = await prisma.annualBudget.findUniqueOrThrow({
      where: { budget_id: childBudget.parent_budget_id! },
      select: {
        total_budget: true,
        efficiency_tag: true,
      },
    });

    const totalAnnualBudget = Number(childBudget.total_budget) + Number(parentBudget.total_budget);
    const monthlyBudget = totalAnnualBudget / 12;
    const dailyIdealBurn = monthlyBudget / totalDaysInMonth;

    const parentTotal = Number(parentBudget.total_budget);
    const efficiencyTag = Number(parentBudget.efficiency_tag) || 1;

    const annualEfficientBudget = parentTotal * efficiencyTag;
    const monthlyEfficientBudget = annualEfficientBudget / 12;
    const dailyEfficientBurn = monthlyEfficientBudget / totalDaysInMonth;

    const summaries = await prisma.dailySummary.findMany({
      where: {
        summary_date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        summary_date: true,
        total_cost: true,
      },
      orderBy: {
        summary_date: 'asc',
      },
    });

    const dailyCostMap = new Map<number, number>();
    summaries.forEach((item) => {
      const day = new Date(item.summary_date).getDate();
      const current = dailyCostMap.get(day) ?? 0;
      dailyCostMap.set(day, current + Number(item.total_cost));
    });

    const results: BudgetBurnRateType[] = [];

    let cumulativeActual = 0;

    const today = new Date();
    const isCurrentMonth = today.getMonth() + 1 === month && today.getFullYear() === year;
    const currentDay = today.getDate();

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const cumulativeIdeal = dailyIdealBurn * day;

      const cumulativeEfficient = dailyEfficientBurn * day;

      const costToday = dailyCostMap.get(day) ?? 0;

      let actualValue: number | null = null;

      if (isCurrentMonth) {
        if (day <= currentDay) {
          cumulativeActual += costToday;
          actualValue = Math.round(cumulativeActual);
        } else {
          actualValue = null;
        }
      } else {
        if (new Date(year, month - 1) < today) {
          cumulativeActual += costToday;
          actualValue = Math.round(cumulativeActual);
        }
      }

      results.push({
        dayDate: day,
        actual: actualValue,
        idea: Math.round(cumulativeIdeal),
        efficent: Math.round(cumulativeEfficient),
      });
    }

    return results;
  } catch (error) {
    console.error('Error in BudgetBurnRateService:', error);
    return [];
  }
};
export const getFuelRefillAnalysisService = async (
  year: number,
  meterId: number,
): Promise<getFuelRefillAnalysisType[]> => {
  try {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 12, 0, 23, 59, 59);

    const [consumptions, stockLogs, lastYearStockData] = await Promise.all([
      prisma.summaryDetail.findMany({
        where: {
          summary: {
            summary_date: { gte: startDate, lte: endDate },
            meter_id: meterId,
          },
          metric_name: {
            contains: 'Pemakaian Harian (Fuel)',
            mode: 'insensitive',
          },
        },
        select: {
          summary: { select: { summary_date: true } },
          consumption_value: true,
        },
      }),

      prisma.summaryDetail.findMany({
        where: {
          summary: {
            summary_date: { gte: startDate, lte: endDate },
            meter_id: meterId,
          },
          remaining_stock: { not: null },
        },
        select: {
          summary: { select: { summary_date: true } },
          remaining_stock: true,
        },
        orderBy: { summary: { summary_date: 'asc' } },
      }),

      prisma.summaryDetail.findFirst({
        where: {
          summary: {
            summary_date: { lt: startDate },

            meter_id: meterId,
          },
          remaining_stock: { not: null },
        },
        orderBy: { summary: { summary_date: 'desc' } },

        select: { remaining_stock: true },
      }),
    ]);

    const monthlyStats = new Map<number, { consumption: number; lastStock: number | null }>();

    for (let i = 0; i < 12; i++) {
      monthlyStats.set(i, { consumption: 0, lastStock: null });
    }

    consumptions.forEach((item) => {
      const idx = new Date(item.summary.summary_date).getMonth();
      const val = Number(item.consumption_value ?? 0);
      if (monthlyStats.has(idx)) {
        monthlyStats.get(idx)!.consumption += val;
      }
    });

    stockLogs.forEach((item) => {
      const idx = new Date(item.summary.summary_date).getMonth();
      const val = Number(item.remaining_stock ?? 0);
      if (monthlyStats.has(idx)) {
        monthlyStats.get(idx)!.lastStock = val;
      }
    });

    const results: getFuelRefillAnalysisType[] = [];

    let previousMonthStock = Number(lastYearStockData?.remaining_stock ?? 0);

    for (let i = 0; i < 12; i++) {
      const stats = monthlyStats.get(i)!;

      const currentEndStock = stats.lastStock ?? previousMonthStock;

      const consumption = stats.consumption;

      let calculatedRefill = currentEndStock - previousMonthStock + consumption;

      if (calculatedRefill < 0) calculatedRefill = 0;

      results.push({
        month: MONTH_NAMES[i],
        refill: Math.round(calculatedRefill),
        consumption: Math.round(consumption),
        remainingStock: Math.round(currentEndStock),
      });

      previousMonthStock = currentEndStock;
    }

    return results;
  } catch (error) {
    console.error('Error in getFuelRefillAnalysisService:', error);
    return [];
  }
};

export const getTrentConsumptionService = async (
  energyTypeName: string,
  year: number, // [FIX] Tambahkan parameter year
  month: number, // Bulan 1-12
  meterId?: number, // [FIX] Opsional
): Promise<MeterAnalysisData[]> => {
  // [FIX] Gunakan Date.UTC untuk menghindari masalah Timezone server
  const monthIndex = month - 1;
  const startDate = new Date(Date.UTC(year, monthIndex, 1));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

  // 1. Validasi Tipe Energi
  const energyTypeRecord = await prisma.energyType.findUnique({
    where: { type_name: energyTypeName },
  });

  if (!energyTypeRecord) {
    throw new Error404(`Tipe energi '${energyTypeName}' tidak ditemukan.`);
  }

  const energyTypeId = energyTypeRecord.energy_type_id;

  // 2. Fetch Data Paralel
  const [summaries, predictions, targets] = await Promise.all([
    // A. Actual Data
    prisma.dailySummary.findMany({
      where: {
        meter: {
          energy_type_id: energyTypeId,
          ...(meterId !== undefined && { meter_id: meterId }), // Cek undefined agar id 0 tetap terbaca (jika ada)
        },
        summary_date: { gte: startDate, lte: endDate },
      },
      include: {
        meter: { select: { meter_id: true, meter_code: true } },
        classification: true,
      },
    }),

    // B. Prediction Data
    prisma.consumptionPrediction.findMany({
      where: {
        meter: {
          energy_type_id: energyTypeId,
          ...(meterId !== undefined && { meter_id: meterId }),
        },
        prediction_date: { gte: startDate, lte: endDate },
      },
      include: {
        meter: { select: { meter_id: true, meter_code: true } },
      },
    }),

    // C. Efficiency Targets
    prisma.efficiencyTarget.findMany({
      where: {
        meter: {
          energy_type_id: energyTypeId,
          ...(meterId !== undefined && { meter_id: meterId }),
        },
        // Ambil target yang aktif/overlap dalam rentang tanggal ini
        period_start: { lte: endDate },
        period_end: { gte: startDate },
      },
    }),
  ]);

  // 3. Helper Types & Map Init
  interface TempData {
    actual?: number;
    cost?: number;
    prediction?: number;
    classification?: any;
    confidence?: any;
  }

  const meterMap = new Map<number, { name: string; dates: Map<string, TempData> }>();

  const getOrInitMeter = (id: number, name: string) => {
    if (!meterMap.has(id)) {
      meterMap.set(id, { name, dates: new Map() });
    }
    return meterMap.get(id)!;
  };

  const getOrInitDate = (datesMap: Map<string, TempData>, dateKey: string) => {
    if (!datesMap.has(dateKey)) {
      datesMap.set(dateKey, {});
    }
    return datesMap.get(dateKey)!;
  };

  // 4. Mapping Data ke Map Structure

  // Process Summaries
  for (const item of summaries) {
    const meterEntry = getOrInitMeter(item.meter_id, item.meter.meter_code);
    const dateKey = item.summary_date.toISOString().split('T')[0];
    const dataEntry = getOrInitDate(meterEntry.dates, dateKey);

    dataEntry.actual = item.total_consumption?.toNumber() ?? undefined;
    dataEntry.cost = item.total_cost?.toNumber() ?? undefined;
    dataEntry.classification = item.classification?.classification ?? null;
    dataEntry.confidence = item.classification?.confidence_score ?? null;
  }

  // Process Predictions
  for (const item of predictions) {
    const meterEntry = getOrInitMeter(item.meter_id, item.meter.meter_code);
    const dateKey = item.prediction_date.toISOString().split('T')[0];
    const dataEntry = getOrInitDate(meterEntry.dates, dateKey);

    dataEntry.prediction = item.predicted_value?.toNumber() ?? undefined;
  }

  // 5. Build Time Series (Looping Tanggal Penuh)
  const finalResults: MeterAnalysisData[] = [];

  for (const [mId, mData] of meterMap.entries()) {
    const timeSeries: DailyAnalysisRecord[] = [];

    // Gunakan pointer tanggal baru untuk setiap meter agar tidak side-effect
    const currentDateIter = new Date(startDate);

    while (currentDateIter <= endDate) {
      const dateKey = currentDateIter.toISOString().split('T')[0];
      const dayData = mData.dates.get(dateKey) ?? {};

      // Cari target yang valid pada hari spesifik ini
      const activeTarget = targets.find(
        (t) =>
          t.meter_id === mId &&
          t.period_start <= currentDateIter &&
          t.period_end >= currentDateIter,
      );

      timeSeries.push({
        date: new Date(currentDateIter), // Clone date object
        actual_consumption: dayData.actual ?? null,
        consumption_cost: dayData.cost ?? null,
        prediction: dayData.prediction ?? null,
        classification: dayData.classification ?? null,
        confidence_score: dayData.confidence ?? null,
        efficiency_target: activeTarget
          ? Number(activeTarget.target_value) // Pastikan convert Decimal ke Number
          : null,
        efficiency_target_cost: activeTarget?.target_cost ? Number(activeTarget.target_cost) : null,
      });

      // Increment hari (UTC Safe)
      currentDateIter.setUTCDate(currentDateIter.getUTCDate() + 1);
    }

    finalResults.push({
      meterId: mId,
      meterName: mData.name,
      data: timeSeries,
    });
  }

  return finalResults;
};
