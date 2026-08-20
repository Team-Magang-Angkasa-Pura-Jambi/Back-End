import prisma from '../../configs/db.js';
import { Prisma } from '../../generated/prisma/index.js';
import { Decimal } from '../../generated/prisma/runtime/library.js';
import { Error400, Error404 } from '../../utils/customError.js';
import { fetchMonthlyData } from './helper/fetchMonthlyData.js';
import { dashboardConfigService, } from './dashboard_config.service.js';
import {
  HeatmapDay,
  HeatmapMonthGroup,
  UsageCategory,
  YearlyHeatmapResult,
} from './types/getYearlyHeatmap.type.js';
import { DashboardCardMetersConfig } from '../system_config/system_config.types.js';

export interface EnergySummary {
  consumption: number;
  cost: number;
}

export interface MonthlyDataResponse {
  energySummary: Record<string, EnergySummary>;
  totalPax: number;
  avgTemp: number;
  avgMaxTemp: number;
}

export interface MetricCompare {
  current_value: number;
  unit: string;
  growth_percentage: number;
}

export interface WeatherMetric {
  average_temp: number;
  max_temp: number;
  unit: string;
}

export interface EnergyMetricCard {
  consumption: MetricCompare;
  cost: MetricCompare;
}

export interface MetricCardsResult {
  overview_metrics: {
    pax: MetricCompare;
    weather: WeatherMetric;
    energy: Record<string, EnergyMetricCard>;
    card_config?: unknown;
  };
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
const STATUS_COLORS: Record<UsageCategory, string> = {
  SANGAT_EFISIEN: 'bg-emerald-500 text-white',
  NORMAL: 'bg-slate-200 dark:bg-slate-800 text-foreground',
  MENDEKATI_LIMIT: 'bg-orange-500 text-white',
  OVER_BUDGET: 'bg-red-500 text-white',
  UNKNOWN: 'bg-indigo-50/50 border border-indigo-100 text-indigo-400',
};
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export interface DailyAnalysisRecord {
  date: Date;
  actual_consumption: number;
  consumption_cost: number;
  prediction: number;
  classification: string | null;
  confidence_score: number | null;
  efficiency_target: number;
  efficiency_target_cost: number;
}

export interface TrentConsumptionResponse {
  meterId: number;
  meterName: string;
  data: DailyAnalysisRecord[];
}

interface MappedDailyData {
  actual: number;
  cost: number;
  pred: number;
  class: string | null;
  conf: number | null;
}

type EfficiencyTargetRecord = {
  meter_id: number;
  period_start: Date;
  period_end: Date;
  baseline_value: Decimal;
};

export interface UnifiedEnergyComparison {
  category: string;
  weekdayValue: number;
  holidayValue: number;
  unit: string;
}

export interface DailyPaxTrend {
  name: string;
  date: Date;
  avgPax: number;
}

export interface EnergyPaxCorrelationResponse {
  energyComparison: UnifiedEnergyComparison[];
  paxTrend: DailyPaxTrend[];
}

export interface FuelMonthRecord {
  month: string;
  consumption: number;
  refill: number;
  remainingStock: number;
}

export interface FuelAnalysisResult {
  chartData: FuelMonthRecord[];
  summary: {
    totalConsumption: number;
    totalRefill: number;
    balance: number;
    lastRefill: string;
    status: 'Safe' | 'Critical';
  };
  latestStockInfo: {
    month: string;
    value: number;
  };
  stockThresholds: {
    minStockLimit: number;
  };
}

export interface TodaySummaryResponse {
  meta: {
    date: Date;
    pax: number | null;
  };
  sumaries: NewDataCountNotification[];
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
export const visualizationService = {
  MetricCards: async (year?: number, month?: number): Promise<MetricCardsResult> => {
    const now = new Date();

    const targetYear = year ?? now.getUTCFullYear();
    const targetMonth = month ?? now.getUTCMonth() + 1;

    const currentStart = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const currentEnd = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

    const prevStart = new Date(currentStart);
    prevStart.setUTCMonth(prevStart.getUTCMonth() - 1);
    const prevEnd = new Date(
      Date.UTC(prevStart.getUTCFullYear(), prevStart.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );

    const [currData, prevData] = await Promise.all<MonthlyDataResponse>([
      fetchMonthlyData(currentStart, currentEnd),
      fetchMonthlyData(prevStart, prevEnd),
    ]);

    const createCompare = (
      currVal: number,
      prevVal: number,
      unitStr: string = '',
    ): MetricCompare => {
      let percentageChange = 0;
      if (prevVal > 0) {
        percentageChange = ((currVal - prevVal) / prevVal) * 100;
      } else if (currVal > 0) {
        percentageChange = 100;
      }

      return {
        current_value: Number(currVal.toFixed(1)),
        unit: unitStr,
        growth_percentage: Number(percentageChange.toFixed(1)),
      };
    };

    const units: Record<string, string> = { Electricity: 'kWh', Fuel: 'liter', Water: 'm3' };
    const defaultEnergyTypes: string[] = ['Electricity', 'Water', 'Fuel'];
    const energyCards: Record<string, EnergyMetricCard> = {};

    const allTypes = new Set<string>([
      ...defaultEnergyTypes,
      ...Object.keys(currData.energySummary),
      ...Object.keys(prevData.energySummary),
    ]);

    allTypes.forEach((type: string) => {
      const c = currData.energySummary[type] ?? { consumption: 0, cost: 0 };
      const p = prevData.energySummary[type] ?? { consumption: 0, cost: 0 };
      const unit = units[type] ?? 'unit';

      energyCards[type.toLowerCase()] = {
        consumption: createCompare(c.consumption, p.consumption, unit),
        cost: createCompare(c.cost, p.cost, 'IDR'),
      };
    });

    const cardConfig = await dashboardConfigService.getCardConfig();

    return {
      overview_metrics: {
        pax: createCompare(currData.totalPax, prevData.totalPax, 'Orang'),
        weather: {
          average_temp: Number(currData.avgTemp.toFixed(1)),
          max_temp: Number(currData.avgMaxTemp.toFixed(1)),
          unit: '°C',
        },
        energy: energyCards,
        card_config: cardConfig,
      },
    };
  },

  getYearlyHeatmapService: async (meterId: number, year: number): Promise<YearlyHeatmapResult> => {
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const [targetEfficiency, dailyRecords] = await Promise.all([
      prisma.efficiencyTarget.findFirst({
        where: { meter_id: meterId },

        select: { baseline_value: true },
      }),

      prisma.dailySummary.findMany({
        where: {
          meter_id: meterId,
          summary_date: { gte: startDate, lte: endDate },
        },
        select: {
          summary_date: true,
          total_usage: true,
          ml_classifications: {
            select: {
              label: true,
              deviation_percent: true,
            },

            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
        orderBy: { summary_date: 'asc' },
      }),
    ]);

    const targetValue = targetEfficiency?.baseline_value
      ? new Decimal(targetEfficiency.baseline_value).toNumber()
      : 0;

    const statsSummary = { SANGAT_EFISIEN: 0, NORMAL: 0, MENDEKATI_LIMIT: 0, OVER_BUDGET: 0 };

    const dbDataMap = new Map<string, (typeof dailyRecords)[0]>();
    dailyRecords.forEach((record) => {
      const dateStr = record.summary_date.toISOString().split('T')[0];
      dbDataMap.set(dateStr, record);
    });

    const groupedData: HeatmapMonthGroup[] = [];
    let totalDaysCounter = 0;

    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const firstDayOfMonth = new Date(Date.UTC(year, monthIdx, 1));
      const lastDayOfMonth = new Date(Date.UTC(year, monthIdx + 1, 0));

      const offset = firstDayOfMonth.getUTCDay();
      const daysInMonth = lastDayOfMonth.getUTCDate();

      const monthName = firstDayOfMonth.toLocaleString('id-ID', { month: 'short' });
      const daysArray: HeatmapDay[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        totalDaysCounter++;
        const currentLoopDate = new Date(Date.UTC(year, monthIdx, day));
        const dateKey = currentLoopDate.toISOString().split('T')[0];

        const record = dbDataMap.get(dateKey);

        let finalStatus: UsageCategory = 'UNKNOWN';
        let confidenceStr: string | null = null;

        if (record) {
          const aiData = record.ml_classifications[0];
          const aiClassification = aiData?.label?.toUpperCase();

          confidenceStr = aiData?.deviation_percent
            ? `${(new Decimal(aiData?.deviation_percent).toNumber() * 100).toFixed(0)}%`
            : null;

          if (aiClassification === 'BOROS' || aiClassification === 'OVER BUDGET') {
            finalStatus = 'OVER_BUDGET';
          } else if (targetValue > 0 && record.total_usage) {
            const consumption = new Decimal(record.total_usage).toNumber();
            const ratio = (consumption / targetValue) * 100;

            if (consumption >= targetValue) {
              finalStatus = 'MENDEKATI_LIMIT';
            } else if (ratio < 75) {
              finalStatus = 'SANGAT_EFISIEN';
            } else {
              finalStatus = 'NORMAL';
            }
          } else {
            finalStatus = 'NORMAL';
          }

          if (finalStatus !== ('UNKNOWN' as string)) {
            statsSummary[finalStatus]++;
          }
        }

        daysArray.push({
          id: dateKey,
          dateDisplay: currentLoopDate.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          status: finalStatus,
          confidence: confidenceStr,
          color: STATUS_COLORS[finalStatus],
        });
      }

      groupedData.push({
        monthName,
        offset,
        days: daysArray,
      });
    }

    return {
      groupedData,
      statsSummary,
      totalDays: totalDaysCounter,
    };
  },

  yearlyAnalysis: async (energyId: number, year: number): Promise<YearlyAnalysisResult> => {
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const [annualBudget, summaries] = await Promise.all([
      prisma.annualBudget.findFirst({
        where: {
          fiscal_year: year,
          energy_type: {
            energy_type_id: energyId,
          },
        },
        select: {
          total_amount: true,
        },
      }),

      prisma.dailySummary.findMany({
        where: {
          summary_date: {
            gte: startDate,
            lte: endDate,
          },
          meter: {
            energy_type: {
              energy_type_id: energyId,
            },
          },
        },
        select: {
          summary_date: true,
          total_usage: true,
          total_cost: true,
        },
      }),
    ]);

    const totalAnnualBudget = annualBudget?.total_amount
      ? new Decimal(annualBudget.total_amount).toNumber()
      : 0;

    const calculatedMonthlyBudget = totalAnnualBudget / 12;

    const result: YearlyAnalysisType[] = Array.from({ length: 12 }, (_, i) => ({
      month: MONTH_NAMES[i],
      consumption: 0,
      cost: 0,
      budget: calculatedMonthlyBudget,
    }));

    summaries.forEach((item) => {
      const monthIndex = item.summary_date.getUTCMonth();

      result[monthIndex].consumption += Number(item.total_usage ?? 0);
      result[monthIndex].cost += Number(item.total_cost ?? 0);
    });

    const now = new Date();
    const currentMonthIndex = now.getMonth();
    const isCurrentYear = year === now.getFullYear();

    let peakMonthObj = result[0];
    let peakConsumptionObj = result[0];

    let overBudgetCount = 0;
    let totalRealizedBudget = 0;
    let totalRealizedCost = 0;

    const validMonthsCount = isCurrentYear ? currentMonthIndex + 1 : 12;

    result.forEach((data, index) => {
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
  },
  trentConsumption: async (
    energyId: number,
    year: number,
    month: number,
    meterId?: number,
  ): Promise<TrentConsumptionResponse[]> => {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const totalDays = endDate.getUTCDate();

    const meters = await prisma.meter.findMany({
      where: {
        energy_type_id: energyId,
        ...(meterId ? { meter_id: meterId } : {}),
      },
      select: { meter_id: true, meter_code: true },
    });

    if (!meters.length) return [];

    const meterIds = meters.map((m) => m.meter_id);

    const [summaries, targets, predictions] = await Promise.all([
      prisma.dailySummary.findMany({
        where: {
          meter_id: { in: meterIds },
          summary_date: { gte: startDate, lte: endDate },
        },
        select: {
          meter_id: true,
          summary_date: true,
          total_usage: true,
          total_cost: true,
          ml_classifications: {
            select: { label: true, deviation_percent: true },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      }),

      prisma.efficiencyTarget.findMany({
        where: {
          meter_id: { in: meterIds },
          period_start: { lte: endDate },
          period_end: { gte: startDate },
        },
        select: {
          meter_id: true,
          period_start: true,
          period_end: true,
          baseline_value: true,
        },
      }),

      prisma.mlPrediction.findMany({
        where: {
          meter_id: { in: meterIds },
          target_date: { gte: startDate, lte: endDate },
        },
        select: {
          meter_id: true,
          target_date: true,
          predicted_value: true,
        },
      }),
    ]);

    type TargetRecord = (typeof targets)[0];
    const targetMap = new Map<number, TargetRecord[]>();

    targets.forEach((t) => {
      const existing = targetMap.get(t.meter_id) || [];
      targetMap.set(t.meter_id, [...existing, t]);
    });

    const predMap = new Map<string, number>();
    predictions.forEach((p) => {
      const key = `${p.meter_id}_${p.target_date.getUTCDate()}`;
      predMap.set(key, new Decimal(p.predicted_value).toNumber());
    });

    const dataMap = new Map<string, MappedDailyData>();

    summaries.forEach((s) => {
      const dateKey = `${s.meter_id}_${s.summary_date.getUTCDate()}`;
      const aiData = s.ml_classifications?.[0];
      const predVal = predMap.get(dateKey) ?? 0;

      dataMap.set(dateKey, {
        actual: s.total_usage ? new Decimal(s.total_usage).toNumber() : 0,
        cost: s.total_cost ? new Decimal(s.total_cost).toNumber() : 0,
        pred: predVal,
        class: aiData?.label ?? null,
        conf: aiData?.deviation_percent ? new Decimal(aiData?.deviation_percent).toNumber() : null,
      });
    });

    return meters.map((m) => {
      const timeSeries: DailyAnalysisRecord[] = [];
      const activeTargets = targetMap.get(m.meter_id) || [];

      for (let day = 1; day <= totalDays; day++) {
        const dayKey = `${m.meter_id}_${day}`;
        const currentIterDate = new Date(Date.UTC(year, month - 1, day));

        const dayData = dataMap.get(dayKey) || {
          actual: 0,
          cost: 0,
          pred: 0,
          class: null,
          conf: null,
        };

        const target = activeTargets.find(
          (t) => t.period_start <= currentIterDate && t.period_end >= currentIterDate,
        );

        timeSeries.push({
          date: currentIterDate,
          actual_consumption: dayData.actual,
          consumption_cost: dayData.cost,
          prediction: dayData.pred,
          classification: dayData.class,
          confidence_score: dayData.conf,
          efficiency_target: target?.baseline_value
            ? new Decimal(target.baseline_value).toNumber()
            : 0,
          efficiency_target_cost: 0,
        });
      }

      return {
        meterId: m.meter_id,
        meterName: m.meter_code,
        data: timeSeries,
      };
    });
  },
  getEnergyPaxCorrelation: async (
    year: number,
    month: number,
  ): Promise<EnergyPaxCorrelationResponse> => {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const totalDays = endDate.getUTCDate();

    // 1. Ambil list semua tipe energi terlebih dahulu agar yang kosong tetap muncul
    const [energyTypes, energySummaries, paxRecords] = await Promise.all([
      prisma.energyType.findMany({
        select: { name: true, unit_standard: true },
      }),
      prisma.dailySummary.findMany({
        where: {
          summary_date: { gte: startDate, lte: endDate },
        },
        select: {
          summary_date: true,
          total_usage: true,
          meter: {
            select: {
              energy_type: {
                select: { name: true, unit_standard: true },
              },
            },
          },
        },
      }),
      prisma.paxData.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
        },
        select: {
          date: true,
          pax_count: true,
        },
      }),
    ]);

    // 2. Inisialisasi Map dengan SEMUA tipe energi (default 0)
    const energyMap = new Map<
      string,
      {
        weekdaySum: number;
        holidaySum: number;
        unit: string;
        countWeekday: number;
        countHoliday: number;
      }
    >();

    energyTypes.forEach((et) => {
      energyMap.set(et.name, {
        weekdaySum: 0,
        holidaySum: 0,
        countWeekday: 0,
        countHoliday: 0,
        unit: et.unit_standard || 'Unit',
      });
    });

    // 3. Masukkan data summary ke dalam Map
    energySummaries.forEach((summary) => {
      const category = summary.meter?.energy_type?.name || 'Unknown';
      const unit = summary.meter?.energy_type?.unit_standard || 'Unit';
      const usage = summary.total_usage ? new Decimal(summary.total_usage).toNumber() : 0;

      const dayOfWeek = summary.summary_date.getUTCDay();
      const isHoliday = dayOfWeek === 0 || dayOfWeek === 6;

      const existing = energyMap.get(category) || {
        weekdaySum: 0,
        holidaySum: 0,
        countWeekday: 0,
        countHoliday: 0,
        unit,
      };

      if (isHoliday) {
        existing.holidaySum += usage;
        existing.countHoliday += 1; // Hitung hari libur yang ADA DATANYA
      } else {
        existing.weekdaySum += usage;
        existing.countWeekday += 1; // Hitung hari biasa yang ADA DATANYA
      }

      energyMap.set(category, existing);
    });

    // 4. Hitung rata-rata
    const energyComparison: UnifiedEnergyComparison[] = [];

    energyMap.forEach((data, category) => {
      // Jika ingin dibagi dengan hari yang ada datanya saja:
      // (Misal: 22700 / 2 hari = 11350)
      const avgWeekday = data.countWeekday > 0 ? data.weekdaySum / data.countWeekday : 0;
      const avgHoliday = data.countHoliday > 0 ? data.holidaySum / data.countHoliday : 0;

      // CATATAN: Jika Anda TETAP ingin dibagi dengan total hari dalam 1 bulan penuh (seperti kode awal Anda),
      // gunakan numWeekdays dan numHolidays bulan tersebut (contoh: data.holidaySum / 10).

      energyComparison.push({
        category,
        weekdayValue: Number(avgWeekday.toFixed(2)),
        holidayValue: Number(avgHoliday.toFixed(2)),
        unit: data.unit,
      });
    });

    // ... (Bagian paxTrend biarkan sama seperti kode Anda sebelumnya)
    const paxMap = new Map<number, number>();
    paxRecords.forEach((record) => {
      const day = record.date.getUTCDate();
      const pax = record.pax_count ? new Decimal(record.pax_count).toNumber() : 0;

      const existingPax = paxMap.get(day) || 0;
      paxMap.set(day, existingPax + pax);
    });

    const paxTrend: DailyPaxTrend[] = [];
    for (let day = 1; day <= totalDays; day++) {
      const currentDate = new Date(Date.UTC(year, month - 1, day));

      paxTrend.push({
        name: currentDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        date: currentDate,
        avgPax: paxMap.get(day) || 0,
      });
    }

    return {
      energyComparison,
      paxTrend,
    };
  },
  getYearlyLogistics: async (meterId: number, year: number): Promise<FuelAnalysisResult> => {
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const meter = await prisma.meter.findUnique({
      where: { meter_id: meterId },
      include: { tank_profile: true },
    });

    if (!meter || !meter.tank_profile) {
      throw new Error400(
        'Meter ID yang dimasukkan bukan merupakan sebuah tangki atau profil tangki BBM belum di-set',
      );
    }

    const tankCapacity = new Decimal(meter.tank_profile.capacity_liters).toNumber();
    const minStockLimit = Math.round(tankCapacity * 0.2);

    const dailyRecords = await prisma.dailySummary.findMany({
      where: {
        meter_id: meterId,
        summary_date: { gte: startDate, lte: endDate },
      },
      include: {
        summary_details: true,
      },
      orderBy: { summary_date: 'asc' },
    });

    const monthNames = [
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
    const monthlyMap = new Map<
      number,
      { consumption: number; refill: number; lastStock: number }
    >();

    for (let i = 0; i < 12; i++) {
      monthlyMap.set(i, { consumption: 0, refill: 0, lastStock: 0 });
    }

    let totalConsumptionYTD = 0;
    let totalRefillYTD = 0;
    let lastRefillDateStr = '-';
    let lastKnownStock = tankCapacity;

    dailyRecords.forEach((record) => {
      const m = record.summary_date.getUTCMonth();

      const usage = record.total_usage ? new Decimal(record.total_usage).toNumber() : 0;

      const detailRefill = record.summary_details.find((d) => d.label.toUpperCase() === 'REFILL');
      const detailStock = record.summary_details.find(
        (d) => d.label.toUpperCase() === 'STOCK_OPNAME',
      );

      const refill = detailRefill ? new Decimal(detailRefill.value).toNumber() : 0;
      const stock = detailStock ? new Decimal(detailStock.value).toNumber() : 0;

      const currentMonthData = monthlyMap.get(m)!;
      currentMonthData.consumption += usage;
      currentMonthData.refill += refill;

      if (stock > 0) {
        currentMonthData.lastStock = stock;
        lastKnownStock = stock;
      }

      totalConsumptionYTD += usage;
      totalRefillYTD += refill;

      if (refill > 0) {
        lastRefillDateStr = record.summary_date.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    });

    const chartData: FuelMonthRecord[] = [];
    let runningStock = lastKnownStock;

    monthNames.forEach((name, index) => {
      const mData = monthlyMap.get(index)!;

      if (mData.lastStock === 0) {
        runningStock = runningStock + mData.refill - mData.consumption;
      } else {
        runningStock = mData.lastStock;
      }

      runningStock = Math.max(0, runningStock);
      runningStock = Math.min(tankCapacity, runningStock);

      chartData.push({
        month: name,
        consumption: Number(mData.consumption.toFixed(0)),
        refill: Number(mData.refill.toFixed(0)),
        remainingStock: Number(runningStock.toFixed(0)),
      });
    });

    const currentMonthIndex = new Date().getUTCMonth();
    const isPastYear = year < new Date().getUTCFullYear();
    const metricMonthIndex = isPastYear ? 11 : currentMonthIndex;

    const latestStockValue = chartData[metricMonthIndex].remainingStock;

    return {
      chartData,
      summary: {
        totalConsumption: totalConsumptionYTD,
        totalRefill: totalRefillYTD,
        balance: totalRefillYTD - totalConsumptionYTD,
        lastRefill: lastRefillDateStr,
        status: latestStockValue < minStockLimit ? 'Critical' : 'Safe',
      },
      latestStockInfo: {
        month: monthNames[metricMonthIndex],
        value: latestStockValue,
      },
      stockThresholds: {
        minStockLimit,
      },
    };
  },
  getTodaySummary: async (energyId?: number): Promise<TodaySummaryResponse> => {
    const todayInJakarta = new Date();

    const dateString = todayInJakarta.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Jakarta',
    });

    const today = new Date(dateString);

    const whereClause: Prisma.DailySummaryWhereInput = {
      summary_date: today,
    };

    if (energyId) {
      whereClause.meter = {
        energy_type: {
          energy_type_id: energyId,
        },
      };
    }

    const [todaySummaries, paxAggregation] = await Promise.all([
      prisma.dailySummary.findMany({
        where: whereClause,
        include: {
          meter: {
            select: {
              meter_code: true,
              energy_type: {
                select: {
                  name: true,
                  unit_standard: true,
                },
              },
            },
          },

          ml_classifications: {
            select: { label: true },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
        orderBy: { meter: { energy_type: { name: 'asc' } } },
      }),

      prisma.paxData.aggregate({
        where: { date: today },
        _sum: {
          pax_count: true,
        },
      }),
    ]);

    const formattedData: NewDataCountNotification[] = todaySummaries.map((item) => {
      return {
        summary_id: item.summary_id,
        summary_date: item.summary_date,

        total_consumption: item.total_usage?.toNumber() ?? 0,
        total_cost: item.total_cost?.toNumber() ?? 0,

        meter_code: item.meter.meter_code,

        type_name: item.meter.energy_type.name as 'Electricity' | 'Water' | 'Fuel',
        unit_of_measurement: item.meter.energy_type.unit_standard,

        classification: item.ml_classifications[0]?.label ?? null,
      };
    });

    return {
      meta: {
        date: today,
        pax: paxAggregation._sum.pax_count ?? null,
      },
      sumaries: formattedData,
    };
  },
  getCardConfig: async () => {
    return dashboardConfigService.getCardConfigWithMeters();
  },
  updateCardConfig: async (config: DashboardCardMetersConfig, userId?: number) => {
    return dashboardConfigService.updateCardConfig(config, userId);
  },
};
