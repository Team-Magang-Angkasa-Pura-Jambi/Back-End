// src/services/recap.service.ts
import prisma from '../configs/db.js';
import type {
  GetRecapQuery,
  RecapApiResponse,
  RecapDataRow,
  RecapSummary, // Assuming you have this type for the meta/summary object
} from '../types/recap.types.js';
import { BaseService } from '../utils/baseService.js';
import { differenceInDays, getDaysInMonth } from 'date-fns';

// Use constants to avoid "magic strings" and prevent typos
const ENERGY_TYPE = {
  ELECTRICITY: 'Electricity',
};
const METRIC_NAME = {
  DAILY_USAGE: 'Pemakaian Harian',
};

// A helper type for our in-memory aggregated data
type AggregatedDailyData = {
  totalCost: number;
  wbp: number;
  lwbp: number;
  consumption: number;
};

export class RecapService extends BaseService {
  constructor() {
    super(prisma);
  }

  public async getRecap(query: GetRecapQuery): Promise<RecapApiResponse> {
    const { energyType, startDate, endDate, sortBy, sortOrder } = query;

    return this._handleCrudOperation(async () => {
      // LANGKAH 1: Ambil data relevan secara paralel
      const [summaries, paxData, target] = await Promise.all([
        this._prisma.dailySummary.findMany({
          where: {
            meter: { energy_type: { type_name: energyType } },
            summary_date: { gte: startDate, lte: endDate },
          },
          // **OPTIMIZATION**: Only include the specific detail we need
          include: {
            details: {
              where: {
                metric_name: {
                  startsWith: METRIC_NAME.DAILY_USAGE,
                },
              },
            },
          },
        }),
        this._prisma.paxData.findMany({
          where: { data_date: { gte: startDate, lte: endDate } },
        }),
        this._prisma.efficiencyTarget.findFirst({
          where: {
            energy_type: { type_name: energyType },
            period_start: { lte: endDate },
            period_end: { gte: startDate },
          },
        }),
      ]);

      // LANGKAH 2: Agregasi data summary dengan benar untuk menghindari bug overwrite
      const aggregatedSummaries = new Map<string, AggregatedDailyData>();
      for (const summary of summaries) {
        const dateString = summary.summary_date.toISOString().split('T')[0];
        const currentData = aggregatedSummaries.get(dateString) ?? {
          totalCost: 0,
          wbp: 0,
          lwbp: 0,
          consumption: 0,
        };

        currentData.totalCost += summary.total_cost?.toNumber() ?? 0;
        const detail = summary.details[0]; // We only get one due to the optimized query
        if (detail) {
          currentData.wbp += detail.wbp_value?.toNumber() ?? 0;
          currentData.lwbp += detail.lwbp_value?.toNumber() ?? 0;
          currentData.consumption += detail.consumption_value?.toNumber() ?? 0;
        }
        aggregatedSummaries.set(dateString, currentData);
      }

      const paxDataMap = new Map(
        paxData.map((p) => [
          p.data_date.toISOString().split('T')[0],
          p.total_pax,
        ])
      );

      // LANGKAH 3: Hitung target harian secara akurat
      let dailyTarget: number | null = null;
      if (target) {
        const daysInTargetMonth = getDaysInMonth(target.period_start);
        dailyTarget = target.target_value.toNumber() / daysInTargetMonth;
      }

      // LANGKAH 4: Buat kerangka laporan dengan iterasi tanggal yang aman
      const data: RecapDataRow[] = [];
      // Use a new date object for iteration to prevent mutation bugs
      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const currentDate = new Date(d);
        const dateString = currentDate.toISOString().split('T')[0];

        const summaryForDay = aggregatedSummaries.get(dateString);
        const paxForDay = paxDataMap.get(dateString) ?? null;

        // Base structure for the row
        const rowData: RecapDataRow = {
          date: currentDate,
          wbp: null,
          lwbp: null,
          consumption: null,
          target: dailyTarget,
          pax: paxForDay,
          cost: summaryForDay?.totalCost ?? null,
        };

        if (energyType === ENERGY_TYPE.ELECTRICITY) {
          const wbp = summaryForDay?.wbp ?? null;
          const lwbp = summaryForDay?.lwbp ?? null;
          rowData.wbp = wbp;
          rowData.lwbp = lwbp;
          // **FIX**: Correctly calculate consumption for electricity
          rowData.consumption = (wbp ?? 0) + (lwbp ?? 0);
        } else {
          rowData.consumption = summaryForDay?.consumption ?? null;
        }

        data.push(rowData);
      }

      // (Optional) Sort in memory if needed, as Prisma's sort might be lost after filling gaps
      if (sortBy) {
        // Tentukan properti mana yang akan digunakan untuk mengurutkan
        const sortKey = sortBy === 'total_cost' ? 'cost' : 'date';

        data.sort((a, b) => {
          // Ambil nilai dari setiap baris, berikan nilai default untuk 'cost' jika null
          // Gunakan getTime() untuk membandingkan tanggal sebagai angka
          const valA = sortKey === 'date' ? a.date.getTime() : (a.cost ?? -1);
          const valB = sortKey === 'date' ? b.date.getTime() : (b.cost ?? -1);

          // Tentukan hasil perbandingan dasar (ascending)
          let comparison = 0;
          if (valA > valB) {
            comparison = 1;
          } else if (valA < valB) {
            comparison = -1;
          }

          // Balikkan hasil jika urutannya descending
          return sortOrder === 'asc' ? comparison * -1 : comparison;
        });
      }

      // LANGKAH 5: Hitung total agregat dari data yang sudah diproses
      const summary = this._calculateSummary(
        data,
        dailyTarget,
        startDate,
        endDate
      );

      return { data, meta: summary };
    });
  }

  /**
   * Calculates the final summary totals from the processed recap data.
   */
  private _calculateSummary(
    data: RecapDataRow[],
    dailyTarget: number | null,
    startDate: Date,
    endDate: Date
  ): RecapSummary {
    const totalCost = data.reduce((acc, row) => acc + (row.cost ?? 0), 0);
    const totalWbp = data.reduce((acc, row) => acc + (row.wbp ?? 0), 0);
    const totalLwbp = data.reduce((acc, row) => acc + (row.lwbp ?? 0), 0);
    const totalNonElectricityConsumption = data.reduce(
      (acc, row) =>
        row.wbp === null && row.lwbp === null
          ? acc + (row.consumption ?? 0)
          : acc,
      0
    );

    const totalConsumption =
      totalWbp + totalLwbp + totalNonElectricityConsumption;

    // **FIX**: Accurately calculate total target based on the requested date range
    const totalDaysInRange = differenceInDays(endDate, startDate) + 1;
    const totalTarget = dailyTarget ? dailyTarget * totalDaysInRange : 0;
    const totalPax = data.reduce((acc, row) => acc + (row.pax ?? 0), 0);
    return {
      totalCost,
      totalTarget,
      totalConsumption,
      totalWbp,
      totalLwbp,
      totalPax,
    };
  }
}
