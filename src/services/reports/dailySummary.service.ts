import prisma from '../../configs/db.js';
import type { DailySummary, Prisma } from '../../generated/prisma/index.js';
import type {
  CreateSummaryBody,
  GetSummaryQuery,
  UpdateSummaryBody,
} from '../../types/reports/dailySummary.type.js';

import { GenericBaseService } from '../../utils/GenericBaseService.js';
import { weatherService } from '../weather.service.js';

interface ComparisonValue {
  currentValue: number;
  previousValue: number;
  percentageChange: number | null;
}

interface EnergySummary {
  energyType: string;
  unit: string;
  totalConsumption: ComparisonValue;
  totalCost: ComparisonValue;
}

interface MonthlyComparisonReport {
  reportPeriod: {
    year: number;
    month: number;
    monthName: string;
    startDate: string;
    endDate: string;
  };
  totalPax: ComparisonValue;
  summary: EnergySummary[];
  averageTemperature: ComparisonValue;
  averageMaxTemperature: ComparisonValue;
  /**
   * Contains specific temperature data for the current day,
   * only populated if the report period includes today.
   */
  todayTemperature: {
    suhu_rata?: number;
    suhu_max?: number;
    avg_temp?: number;
    max_temp?: number;
  } | null;
}

interface MonthlyData {
  totalPax: number;
  avgTemp: number;
  avgMaxTemp: number;
  todayTemp: {
    suhu_rata?: number;
    suhu_max?: number;
    avg_temp?: number;
    max_temp?: number;
  } | null;
  summary: {
    energyType: string;
    unit: string;
    totalConsumption: number;
    totalCost: number;
  }[];
}

type DailySummaryQuery = GetSummaryQuery;
export class DailySummaryService extends GenericBaseService<
  typeof prisma.dailySummary,
  DailySummary,
  CreateSummaryBody,
  UpdateSummaryBody,
  Prisma.DailySummaryFindManyArgs,
  Prisma.DailySummaryFindUniqueArgs,
  Prisma.DailySummaryCreateArgs,
  Prisma.DailySummaryUpdateArgs,
  Prisma.DailySummaryDeleteArgs
> {
  constructor() {
    super(prisma, prisma.dailySummary, 'summary_id');
  }
  public async findAll(query: DailySummaryQuery = {}) {
    const { month, meterId } = query;

    const where: Prisma.DailySummaryWhereInput = {};

    if (typeof month === 'string') {
      const [yearStr, monthStr] = month.split('-');
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;

      const startDate = new Date(Date.UTC(year, monthIndex, 1));
      const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));

      where.summary_date = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (meterId) {
      where.meter_id = meterId;
    }

    const findArgs: Prisma.DailySummaryFindManyArgs = {
      where,
      include: {
        details: true,
        meter: true,
      },
      orderBy: {
        summary_date: 'desc',
      },
    };

    return this._handleCrudOperation(() => this._model.findMany(findArgs));
  }

  public async getMonthlySummaryReport(
    year: number,
    month: number,
  ): Promise<MonthlyComparisonReport> {
    const buildReport = async (): Promise<MonthlyComparisonReport> => {
      const currentStartDate = new Date(Date.UTC(year, month - 1, 1));
      const currentEndDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

      const previousMonthDate = new Date(currentStartDate);
      previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth() - 1);
      const prevStartDate = new Date(
        Date.UTC(previousMonthDate.getUTCFullYear(), previousMonthDate.getUTCMonth(), 1),
      );
      const prevEndDate = new Date(
        Date.UTC(
          previousMonthDate.getUTCFullYear(),
          previousMonthDate.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      );

      const [currentData, previousData] = await Promise.all([
        this._getMonthlyData(currentStartDate, currentEndDate),
        this._getMonthlyData(prevStartDate, prevEndDate),
      ]);

      const currentSummaryMap = new Map(currentData.summary.map((s) => [s.energyType, s]));
      const previousSummaryMap = new Map(previousData.summary.map((s) => [s.energyType, s]));

      const allEnergyTypes = new Set([...currentSummaryMap.keys(), ...previousSummaryMap.keys()]);

      const summary: EnergySummary[] = Array.from(allEnergyTypes).map((energyType) => {
        const currentSummary = currentSummaryMap.get(energyType);
        const previousSummary = previousSummaryMap.get(energyType);

        const currentValue = currentSummary?.totalConsumption ?? 0;
        const previousValue = previousSummary?.totalConsumption ?? 0;
        const currentCost = currentSummary?.totalCost ?? 0;
        const previousCost = previousSummary?.totalCost ?? 0;

        return {
          energyType: energyType,
          unit: currentSummary?.unit ?? previousSummary?.unit ?? '',
          totalConsumption: {
            currentValue: currentValue,
            previousValue: previousValue,
            percentageChange: this._calculatePercentageChange(currentValue, previousValue),
          },
          totalCost: {
            currentValue: currentCost,
            previousValue: previousCost,
            percentageChange: this._calculatePercentageChange(currentCost, previousCost),
          },
        };
      });

      const finalReport: MonthlyComparisonReport = {
        reportPeriod: {
          year,
          month,
          monthName: new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(currentStartDate),
          startDate: currentStartDate.toISOString(),
          endDate: currentEndDate.toISOString(),
        },
        totalPax: {
          currentValue: currentData.totalPax,
          previousValue: previousData.totalPax,
          percentageChange: this._calculatePercentageChange(
            currentData.totalPax,
            previousData.totalPax,
          ),
        },

        averageTemperature: {
          currentValue: currentData.avgTemp,
          previousValue: previousData.avgTemp,
          percentageChange: this._calculatePercentageChange(
            currentData.avgTemp,
            previousData.avgTemp,
          ),
        },

        averageMaxTemperature: {
          currentValue: currentData.avgMaxTemp,
          previousValue: previousData.avgMaxTemp,
          percentageChange: this._calculatePercentageChange(
            currentData.avgMaxTemp,
            previousData.avgMaxTemp,
          ),
        },

        todayTemperature: currentData.todayTemp,
        summary,
      };

      return finalReport;
    };

    return this._handleCrudOperation(buildReport);
  }

  private async _getMonthlyData(startDate: Date, endDate: Date): Promise<MonthlyData> {
    let todayWeather: {
      suhu_rata?: number;
      suhu_max?: number;
      avg_temp?: number;
      max_temp?: number;
    } | null = null;
    const today = new Date();

    const todayUTC = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    if (endDate >= todayUTC && startDate <= todayUTC) {
      todayWeather = await weatherService.getForecast(today);
    }

    const [aggregates, paxAggregate, weatherAggregate] = await Promise.all([
      prisma.dailySummary.groupBy({
        by: ['meter_id'],
        where: {
          summary_date: { gte: startDate, lte: endDate },
        },
        _sum: {
          total_consumption: true,
          total_cost: true,
        },
      }),
      prisma.paxData.aggregate({
        where: { data_date: { gte: startDate, lte: endDate } },
        _sum: { total_pax: true },
      }),

      prisma.weatherHistory.aggregate({
        where: { data_date: { gte: startDate, lte: endDate } },
        _avg: { avg_temp: true, max_temp: true },
      }),
    ]);

    if (aggregates.length === 0) {
      return {
        totalPax: paxAggregate._sum.total_pax ?? 0,
        summary: [],
        avgTemp: weatherAggregate._avg.avg_temp?.toNumber() ?? 0,
        avgMaxTemp: weatherAggregate._avg.max_temp?.toNumber() ?? 0,
        todayTemp: todayWeather
          ? {
              avg_temp: todayWeather.suhu_rata,
              max_temp: todayWeather.suhu_max,
            }
          : null,
      };
    }

    const meterIds = aggregates.map((agg) => agg.meter_id);
    const meters = await prisma.meter.findMany({
      where: { meter_id: { in: meterIds } },
      include: { energy_type: true },
    });
    const meterMap = new Map(meters.map((m) => [m.meter_id, m]));

    const summaryMap = new Map<string, any>();
    for (const agg of aggregates) {
      const meter = meterMap.get(agg.meter_id);
      if (!meter) continue;

      const energyTypeName = meter.energy_type.type_name;
      const current = summaryMap.get(energyTypeName) ?? {
        totalConsumption: 0,
        totalCost: 0,
      };

      current.totalConsumption += agg._sum.total_consumption?.toNumber() ?? 0;
      current.totalCost += agg._sum.total_cost?.toNumber() ?? 0;
      summaryMap.set(energyTypeName, {
        ...current,
        energyType: energyTypeName,
        unit: meter.energy_type.unit_of_measurement,
      });
    }

    const summary = Array.from(summaryMap.values()).map((s) => {
      return {
        energyType: s.energyType,
        unit: s.unit,
        totalConsumption: s.totalConsumption,
        totalCost: s.totalCost,
      };
    });

    return {
      totalPax: paxAggregate._sum.total_pax ?? 0,
      summary,

      avgTemp: weatherAggregate._avg.avg_temp?.toNumber() ?? 0,
      avgMaxTemp: weatherAggregate._avg.max_temp?.toNumber() ?? 0,
      todayTemp: todayWeather
        ? { avg_temp: todayWeather.suhu_rata, max_temp: todayWeather.suhu_max }
        : null,
    };
  }

  private _calculatePercentageChange(current: number, previous: number): number | null {
    if (previous === 0) {
      return current > 0 ? null : 0;
    }
    const change = ((current - previous) / previous) * 100;
    return parseFloat(change.toFixed(2));
  }
}

export const dailySummaryService = new DailySummaryService();
