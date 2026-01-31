import prisma from '../../configs/db.js';
import {
  type DailySummary,
  type EfficiencyTarget,
  type PaxData,
  type Prisma,
  type SummaryDetail,
} from '../../generated/prisma/index.js';
import type {
  GetRecapQuery,
  RecapApiResponse,
  RecapDataRow,
  RecapSummary,
} from '../../types/reports/recap.types.js';
import { BaseService } from '../../utils/baseService.js';
import { SocketServer } from '../../configs/socket.js';
import { classifyOffice, classifyTerminal } from '../intelligence/classify.service.js';

type NotificationEvent = 'recalculation:success' | 'recalculation:progress' | 'recalculation:error';

export class RecapService extends BaseService {
  constructor() {
    super(prisma);
  }

  public async getRecap(query: GetRecapQuery): Promise<RecapApiResponse> {
    const { energyType, sortBy, sortOrder, meterId, startDate, endDate } = query;

    // --- LOGIK KHUSUS BBM (FUEL) ---
    if (energyType === 'Fuel') {
      return this._handleFuelRecap(startDate, endDate, meterId);
    }

    // --- LOGIK LISTRIK & AIR ---
    return this._handleCrudOperation(async () => {
      const whereClause: Prisma.DailySummaryWhereInput = {
        meter: {
          energy_type: { type_name: energyType },
          ...(meterId && { meter_id: meterId }),
        },
        summary_date: { gte: startDate, lte: endDate },
      };

      const [summaries, paxData, efficiencyTargets, weatherHistories, predictions] =
        await Promise.all([
          prisma.dailySummary.findMany({
            where: whereClause,
            include: {
              details: true,
              classification: true,
              meter: {
                include: {
                  tariff_group: {
                    include: {
                      price_schemes: {
                        where: { is_active: true },
                        include: {
                          taxes: { include: { tax: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          prisma.paxData.findMany({
            where: { data_date: { gte: startDate, lte: endDate } },
          }),
          prisma.efficiencyTarget.findMany({
            where: {
              ...(meterId && { meter_id: meterId }),
              period_start: { lte: endDate },
              period_end: { gte: startDate },
            },
          }),
          prisma.weatherHistory.findMany({
            where: { data_date: { gte: startDate, lte: endDate } },
          }),
          meterId
            ? prisma.consumptionPrediction.findMany({
                where: {
                  meter_id: meterId,
                  prediction_date: { gte: startDate, lte: endDate },
                },
              })
            : Promise.resolve([]),
        ]);

      // Mapping data untuk akses cepat
      const paxMap = new Map(
        paxData.map((p: PaxData) => [p.data_date.toISOString().split('T')[0], p.total_pax]),
      );
      const weatherMap = new Map(
        weatherHistories.map((w: any) => [w.data_date.toISOString().split('T')[0], w]),
      );
      const predictMap = new Map(
        predictions.map((p: any) => [
          p.prediction_date.toISOString().split('T')[0],
          p.predicted_value.toNumber(),
        ]),
      );

      // Hitung tarif pajak dinamis dari skema yang aktif
      let taxRate = 0;
      const sampleWithScheme = summaries.find(
        (s: any) => s.meter?.tariff_group?.price_schemes?.length > 0,
      );

      if (sampleWithScheme) {
        // Menggunakan helper untuk menghitung total pajak (bisa 1, 2, atau lebih)
        taxRate = this._getTaxRateFromMeter((sampleWithScheme as any).meter);
      }

      const data: RecapDataRow[] = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const currentDate = new Date(d);
        const dateStr = currentDate.toISOString().split('T')[0];

        const summaryForDate = summaries.filter(
          (s: DailySummary) => s.summary_date.toISOString().split('T')[0] === dateStr,
        );
        const target = efficiencyTargets.find(
          (t: EfficiencyTarget) => currentDate >= t.period_start && currentDate <= t.period_end,
        );

        const consumption = summaryForDate.reduce(
          (sum: number, s: DailySummary) => sum + (s.total_consumption?.toNumber() ?? 0),
          0,
        );
        const cost = summaryForDate.reduce(
          (sum: number, s: DailySummary) => sum + (s.total_cost?.toNumber() ?? 0),
          0,
        );

        data.push({
          date: currentDate,
          wbp:
            summaryForDate
              .flatMap((s: any) => s.details)
              .find((d: SummaryDetail) => d.metric_name === 'Pemakaian WBP')
              ?.consumption_value?.toNumber() ?? null,
          lwbp:
            summaryForDate
              .flatMap((s: any) => s.details)
              .find((d: SummaryDetail) => d.metric_name === 'Pemakaian LWBP')
              ?.consumption_value?.toNumber() ?? null,
          consumption: consumption || null,
          cost: cost || null,
          classification: summaryForDate[0]?.classification?.classification ?? null,
          confidence_score: summaryForDate[0]?.classification?.confidence_score ?? null,
          target: target?.target_value.toNumber() ?? null,
          prediction: predictMap.get(dateStr) ?? null,
          pax: paxMap.get(dateStr) ?? null,
          avg_temp: weatherMap.get(dateStr)?.avg_temp?.toNumber() ?? null,
          max_temp: weatherMap.get(dateStr)?.max_temp?.toNumber() ?? null,
          is_workday: currentDate.getDay() >= 1 && currentDate.getDay() <= 5,
        });
      }

      if (sortBy) {
        data.sort((a, b) => {
          const valA =
            sortBy === 'date' ? a.date.getTime() : (a[sortBy as keyof RecapDataRow] ?? -1);
          const valB =
            sortBy === 'date' ? b.date.getTime() : (b[sortBy as keyof RecapDataRow] ?? -1);
          return sortOrder === 'desc' ? (valA < valB ? 1 : -1) : valA > valB ? 1 : -1;
        });
      }

      return { data, meta: this._calculateSummary(data, energyType, taxRate) };
    });
  }

  private async _handleFuelRecap(
    startDate: Date,
    endDate: Date,
    meterId?: number,
  ): Promise<RecapApiResponse> {
    const summaries = await prisma.dailySummary.findMany({
      where: {
        summary_date: { gte: startDate, lte: endDate },
        meter: {
          energy_type: { type_name: 'Fuel' },
          ...(meterId && { meter_id: meterId }),
        },
      },
      include: {
        meter: {
          include: {
            tariff_group: {
              include: {
                price_schemes: {
                  include: {
                    rates: true,
                    taxes: { include: { tax: true } },
                  },
                  where: { is_active: true },
                },
              },
            },
          },
        },
      },
      orderBy: { summary_date: 'asc' },
    });

    // Hitung tarif pajak dinamis untuk BBM
    let taxRate = 0;
    const sampleSummary = summaries.find(
      (s: any) => s.meter?.tariff_group?.price_schemes?.length > 0,
    );
    if (sampleSummary) {
      taxRate = this._getTaxRateFromMeter((sampleSummary as any).meter);
    }

    const fuelData: RecapDataRow[] = summaries.map((summary: any) => {
      return {
        date: summary.summary_date,
        consumption: summary.total_consumption?.toNumber() ?? 0,
        cost: summary.total_cost?.toNumber() ?? 0,
        remaining_stock: 0,
        pax: null,
        wbp: null,
        lwbp: null,
        classification: null,
        target: null,
        avg_temp: null,
        max_temp: null,
        is_workday: false,
      };
    });

    return {
      data: fuelData,
      meta: this._calculateSummary(fuelData, 'Fuel', taxRate),
    };
  }

  /**
   * Helper untuk menghitung total persentase pajak dari meter.
   * Menghitung pajak secara kumulatif dari DPP yang sama (misal: Cost * (PPN + PPJ)).
   */
  private _getTaxRateFromMeter(meter: any): number {
    const scheme = meter?.tariff_group?.price_schemes?.[0];
    if (scheme?.taxes?.length > 0) {
      return scheme.taxes.reduce(
        (acc: number, curr: any) => acc + (curr.tax?.rate?.toNumber() ?? 0),
        0,
      );
    }
    return 0;
  }

  private _calculateSummary(data: RecapDataRow[], energyType: string, taxRate = 0): RecapSummary {
    const totalSumCost = data.reduce((sum, row) => sum + (row.cost ?? 0), 0);
    const totalConsumption = data.reduce((sum, row) => sum + (row.consumption ?? 0), 0);
    const totalPax = data.reduce((sum, row) => sum + (Number(row.pax) || 0), 0);

    let totalCost = totalSumCost;
    const totalCostBeforeTax = totalSumCost;

    // Terapkan pajak jika ada (totalCost = preTax * (1 + taxRate))
    if (taxRate > 0) {
      totalCost = totalSumCost * (1 + taxRate);
    }

    return {
      totalCost,
      totalCostBeforeTax,
      totalTarget: data.reduce((sum, row) => sum + (row.target ?? 0), 0),
      totalConsumption,
      totalWbp:
        energyType === 'Electricity' ? data.reduce((sum, row) => sum + (row.wbp ?? 0), 0) : 0,
      totalLwbp:
        energyType === 'Electricity' ? data.reduce((sum, row) => sum + (row.lwbp ?? 0), 0) : 0,
      totalPax,
    };
  }

  public async recalculateSummaries(
    startDate: Date,
    endDate: Date,
    meterId?: number,
    userId?: number,
  ): Promise<void> {
    const notify = (event: NotificationEvent, data: any) =>
      userId && SocketServer.instance.io.to(String(userId)).emit(event, data);

    try {
      const summaries = await prisma.dailySummary.findMany({
        where: {
          summary_date: { gte: startDate, lte: endDate },
          ...(meterId && { meter_id: meterId }),
        },
        include: {
          meter: {
            include: {
              energy_type: true,
              category: true,
              tariff_group: {
                include: {
                  price_schemes: {
                    include: {
                      rates: { include: { reading_type: true } },
                      taxes: { include: { tax: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      for (let i = 0; i < summaries.length; i++) {
        notify('recalculation:progress', {
          processed: i + 1,
          total: summaries.length,
        });
        if (summaries[i].meter.category.name === 'Office') {
          await classifyOffice(summaries[i].summary_date, summaries[i].meter_id);
        } else {
          await classifyTerminal(summaries[i].summary_date, summaries[i].meter_id);
        }
      }

      notify('recalculation:success', {
        message: `Selesai memproses ${summaries.length} data.`,
        total: summaries.length,
      });
    } catch (error) {
      notify('recalculation:error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const recapService = new RecapService();
