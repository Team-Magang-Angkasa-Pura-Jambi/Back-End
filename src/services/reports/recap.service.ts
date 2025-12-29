import prisma from '../../configs/db.js';

import {
  DailySummary,
  EfficiencyTarget,
  PaxData,
  Prisma,
  SummaryDetail,
} from '../../generated/prisma/index.js';
import type {
  GetRecapQuery,
  RecapApiResponse,
  RecapDataRow,
  RecapSummary,
} from '../../types/recap.types.js';
import { notificationService } from '../notification.service.js';
import { BaseService } from '../../utils/baseService.js';
import { SocketServer } from '../../configs/socket.js';
import { Decimal } from '@prisma/client/runtime/library';
import { _classifyDailyUsage } from '../metering/helpers/forecast-calculator.js';

type AggregatedDailyData = {
  costBeforeTax: number;
  costWithTax: number;
  wbp: number;
  lwbp: number;
  consumption: number;
};
type NotificationEvent =
  | 'recalculation:success'
  | 'recalculation:progress'
  | 'recalculation:error'
  | 'data_reminder'
  | 'new_notification'
  | 'new_message'
  | 'server_info'
  | 'new_notification_available';
type WeatherValue = {
  avg_temp: Decimal | null;
  max_temp: Decimal | null;
};

type DataSocket = {
  message: string;
  processed: number;
  total: number;
};

export class RecapService extends BaseService {
  constructor() {
    super(prisma);
  }

  /**
   * Helper untuk menghitung persentase perubahan dengan aman.
   */
  private _calculatePercentageChange(
    current: number,
    previous: number
  ): number | null {
    if (previous === 0) {
      return current > 0 ? null : 0;
    }
    const change = ((current - previous) / previous) * 100;
    return parseFloat(change.toFixed(2));
  }

  /**
   * BARU: Helper privat untuk mengambil dan mengagregasi data untuk periode tertentu.
   */
  private async _getAggregatedDataForPeriod(
    startDate: Date,
    endDate: Date,
    query: GetRecapQuery
  ) {
    const { energyType, meterId } = query;

    const whereClause: Prisma.DailySummaryWhereInput = {
      summary_date: { gte: startDate, lte: endDate },
      meter: {
        energy_type: { type_name: energyType },
        ...(meterId && { meter_id: meterId }),
      },
    };

    const [summaryAggregates, paxAggregate, targetAggregates] =
      await Promise.all([
        this._prisma.dailySummary.aggregate({
          _sum: {
            total_consumption: true,
            total_cost: true,
          },
          where: whereClause,
        }),
        this._prisma.paxData.aggregate({
          _sum: { total_pax: true },
          where: {
            data_date: { gte: startDate, lte: endDate },
          },
        }),
        this._prisma.efficiencyTarget.aggregate({
          _sum: {
            target_value: true,
            target_cost: true,
          },
          where: {
            meter: {
              energy_type: { type_name: energyType },
              ...(meterId && { meter_id: meterId }),
            },

            period_start: { lte: endDate },
            period_end: { gte: startDate },
          },
        }),
      ]);

    const targets = await this._prisma.efficiencyTarget.findMany({
      where: {
        meter: {
          energy_type: { type_name: energyType },
          ...(meterId && { meter_id: meterId }),
        },
        period_start: { lte: endDate },
        period_end: { gte: startDate },
      },
    });

    let totalTargetConsumption = 0;
    let totalTargetCost = 0;

    for (const target of targets) {
      const overlapStart = Math.max(
        startDate.getTime(),
        target.period_start.getTime()
      );
      const overlapEnd = Math.min(
        endDate.getTime(),
        target.period_end.getTime()
      );
      const days = (overlapEnd - overlapStart) / (1000 * 3600 * 24) + 1;
      if (days > 0) {
        totalTargetConsumption += target.target_value.toNumber() * days;
        totalTargetCost += (target.target_cost?.toNumber() ?? 0) * days;
      }
    }

    return {
      total_consumption:
        summaryAggregates._sum.total_consumption?.toNumber() ?? 0,
      total_cost: summaryAggregates._sum.total_cost?.toNumber() ?? 0,
      total_pax: paxAggregate._sum.total_pax ?? 0,
      total_target_consumption: totalTargetConsumption,
      total_target_cost: totalTargetCost,
    };
  }

  public async getRecap(query: GetRecapQuery): Promise<RecapApiResponse> {
    const { energyType, sortBy, sortOrder, meterId } = query;
    let { startDate, endDate } = query;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    console.log(endDate);
    if (energyType == 'Fuel') {
      const whereClause: Prisma.ReadingSessionWhereInput = {
        reading_date: { gte: startDate, lte: endDate },
        ...(meterId && { meter_id: meterId }),
      };

      const fuelSessions = await this._prisma.readingSession.findMany({
        where: whereClause,
        include: {
          details: true,
          meter: {
            include: {
              tariff_group: {
                include: {
                  price_schemes: {
                    include: { rates: true },
                    where: { is_active: true },
                    orderBy: { effective_date: 'desc' },
                  },
                },
              },
            },
          },
        },
        orderBy: { reading_date: 'asc' },
      });

      const fuelData: RecapDataRow[] = [];

      for (let i = 0; i < fuelSessions.length; i++) {
        const currentSession = fuelSessions[i];

        const previousSession = i > 0 ? fuelSessions[i - 1] : null;

        const currentHeight =
          currentSession.details[0]?.value ?? new Prisma.Decimal(0);
        console.log(currentHeight);
        const previousHeight =
          previousSession?.details[0]?.value ?? new Prisma.Decimal(0);

        let consumptionLiters = new Prisma.Decimal(0);
        let cost = new Prisma.Decimal(0);
        let remainingStockLiters = new Prisma.Decimal(0);

        if (previousSession && currentHeight.lessThan(previousHeight)) {
          const meter = currentSession.meter;
          const heightDiff = previousHeight.minus(currentHeight);
          const litersPerCm = new Prisma.Decimal(meter.tank_volume_liters!).div(
            meter.tank_height_cm!
          );
          consumptionLiters = heightDiff.times(litersPerCm);

          const priceScheme = meter.tariff_group.price_schemes[0];
          const fuelPrice =
            priceScheme?.rates[0]?.value ?? new Prisma.Decimal(0);
          cost = consumptionLiters.times(fuelPrice);
        }

        const meter = currentSession.meter;
        const litersPerCm = new Prisma.Decimal(meter.tank_volume_liters!).div(
          meter.tank_height_cm!
        );
        remainingStockLiters = currentHeight.times(litersPerCm);

        fuelData.push({
          date: currentSession.reading_date,
          consumption: consumptionLiters.toNumber(),
          cost: cost.toNumber(),

          pax: null,
          wbp: null,
          lwbp: null,
          classification: null,
          target: null,
          avg_temp: null,
          max_temp: null,
          is_workday: false,
          remaining_stock: remainingStockLiters.toNumber(),
        });
      }

      const fuelSummary = this._calculateSummary(fuelData, 'Fuel');
      return { data: fuelData, meta: fuelSummary };
    }

    return this._handleCrudOperation(async () => {
      const whereClause: Prisma.DailySummaryWhereInput = {
        meter: {
          energy_type: { type_name: energyType },

          ...(meterId && { meter_id: meterId }),
        },
        summary_date: { gte: startDate, lte: endDate },
      };

      const fetchTargetsPromise = meterId
        ? this._prisma.efficiencyTarget.findMany({
            where: {
              meter_id: meterId,

              period_start: { lte: endDate },
              period_end: { gte: startDate },
            },
          })
        : Promise.resolve([]);

      const fecthPredictPromise = meterId
        ? this._prisma.consumptionPrediction.findMany({
            where: {
              meter_id: meterId,
              prediction_date: { gte: startDate, lte: endDate },
            },
          })
        : Promise.resolve([]);

      const [
        summaries,
        paxData,
        efficiencyTargets,
        weatherHistories,
        predictions,
      ] = await Promise.all([
        this._prisma.dailySummary.findMany({
          where: whereClause,

          select: {
            summary_date: true,
            total_cost: true,
            total_consumption: true,
            meter: {
              select: {
                meter_id: true,
                meter_code: true,
                tariff_group: {
                  include: {
                    price_schemes: {
                      include: { taxes: { include: { tax: true } } },
                    },
                  },
                },
              },
            },
            details: true,
            classification: true,
          },
        }),
        this._prisma.paxData.findMany({
          where: { data_date: { gte: startDate, lte: endDate } },
        }),
        fetchTargetsPromise,
        this._prisma.weatherHistory.findMany({
          where: { data_date: { gte: startDate, lte: endDate } },
        }),
        fecthPredictPromise,
      ]);

      const paxDataMap = new Map(
        paxData.map((p: PaxData) => [
          p.data_date.toISOString().split('T')[0],
          p.total_pax,
        ])
      );

      const weatherDataMap = new Map<string, WeatherValue>(
        weatherHistories.map((w: any) => [
          w.data_date.toISOString().split('T')[0],
          { avg_temp: w.avg_temp, max_temp: w.max_temp },
        ])
      );

      const predictionsMap = new Map(
        predictions.map((p: any) => [
          p.prediction_date.toISOString().split('T')[0],
          p.predicted_value.toNumber(),
        ])
      );

      const data: RecapDataRow[] = [];
      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const currentDate = new Date(d);
        const dateString = currentDate.toISOString().split('T')[0];
        const paxForDay = paxDataMap.get(dateString) ?? null;
        const weatherForDay = weatherDataMap.get(dateString);
        const predictionForDay = predictionsMap.get(dateString) ?? null;

        const targetRecord = efficiencyTargets.find(
          (t: EfficiencyTarget) =>
            currentDate >= t.period_start && currentDate <= t.period_end
        );
        const targetForDay = targetRecord
          ? targetRecord.target_value.toNumber()
          : null;

        const summaryForDate = summaries.filter(
          (s: DailySummary) =>
            s.summary_date.toISOString().split('T')[0] === dateString
        );

        const dayOfWeek = currentDate.getDay();
        const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;

        const wbp =
          summaryForDate
            .flatMap((s: any) => s.details)
            .find((d: any) => d.metric_name === 'Pemakaian WBP')
            ?.consumption_value?.toNumber() ?? null;
        const lwbp =
          summaryForDate
            .flatMap((s: any) => s.details)
            .find((d: any) => d.metric_name === 'Pemakaian LWBP')
            ?.consumption_value?.toNumber() ?? null;
        const consumption =
          summaryForDate.reduce(
            (sum: number, s: DailySummary) =>
              sum + (s.total_consumption?.toNumber() ?? 0),
            0
          ) || null;
        const cost =
          summaryForDate.reduce(
            (sum: number, s: DailySummary) =>
              sum + (s.total_cost?.toNumber() ?? 0),
            0
          ) || null;

        data.push({
          date: currentDate,
          wbp,
          lwbp,
          consumption,
          classification:
            summaryForDate[0]?.classification?.classification ?? null,
          confidence_score:
            summaryForDate[0]?.classification?.confidence_score ?? null,
          target: targetForDay,
          prediction: predictionForDay,
          pax: paxForDay,
          cost,

          avg_temp: weatherForDay?.avg_temp?.toNumber() ?? null,
          max_temp: weatherForDay?.max_temp?.toNumber() ?? null,
          is_workday: isWorkday,
        });
      }

      if (sortBy) {
        data.sort((a, b) => {
          const valA = sortBy === 'date' ? a.date.getTime() : (a[sortBy] ?? -1);
          const valB = sortBy === 'date' ? b.date.getTime() : (b[sortBy] ?? -1);
          const comparison = valA > valB ? 1 : valA < valB ? -1 : 0;
          return sortOrder === 'desc' ? comparison * -1 : comparison;
        });
      }

      const summary = this._calculateSummary(data, energyType);

      return { data, meta: summary };
    });
  }

  /**
   * Menghitung total ringkasan akhir dari data rekap yang sudah diproses.
   */
  private _calculateSummary(
    data: RecapDataRow[],
    energyType: 'Electricity' | 'Water' | 'Fuel'
  ): RecapSummary {
    let totalWbp = 0;
    let totalLwbp = 0;

    const totalCost = data.reduce((sum, row) => sum + (row.cost ?? 0), 0);
    const totalConsumption = data.reduce(
      (sum, row) => sum + (row.consumption ?? 0),
      0
    );
    const totalPax = data.reduce(
      (sum, row) => Number(sum) + Number(row.pax ?? 0),
      0
    );

    if (energyType === 'Electricity') {
      if (energyType === 'Electricity') {
        totalWbp = data.reduce((sum, row) => sum + (row.wbp ?? 0), 0);
        totalLwbp = data.reduce((sum, row) => sum + (row.lwbp ?? 0), 0);
      }
    }

    return {
      totalCost,

      totalCostBeforeTax: totalCost,
      totalTarget: data.reduce((sum, row) => sum + (row.target ?? 0), 0),
      totalConsumption,
      totalWbp: totalWbp,
      totalLwbp,
      totalPax,
    };
  }

  /**
   * BARU: Melakukan kalkulasi ulang DailySummary berdasarkan data ReadingSession yang ada.
   * Endpoint ini berguna untuk memperbaiki data ringkasan setelah ada perubahan logika atau harga.
   * @param startDate - Tanggal mulai periode kalkulasi ulang.
   * @param endDate - Tanggal akhir periode kalkulasi ulang.
   * @param meterId - (Opsional) ID meter spesifik yang akan dikalkulasi ulang.
   */
  public async recalculateSummaries(
    startDate: Date,
    endDate: Date,
    meterId?: number,
    userId?: number
  ): Promise<void> {
    const jobDescription = `recalculate-${meterId || 'all'}-${Date.now()}`;
    console.log(
      `[BACKGROUND JOB - ${jobDescription}] Memulai kalkulasi ulang dari ${startDate.toISOString()} hingga ${endDate.toISOString()}`
    );

    const notifyUser = (event: NotificationEvent, data: any) => {
      if (userId) {
        SocketServer.instance.io.to(String(userId)).emit(event, data);
      }
    };

    try {
      const where: Prisma.DailySummaryWhereInput = {
        summary_date: { gte: startDate, lte: endDate },
        ...(meterId && { meter_id: meterId }),
      };

      const summariesToReclassify = await this._prisma.dailySummary.findMany({
        where,
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

      if (summariesToReclassify.length === 0) {
        console.log(
          `[BACKGROUND JOB - ${jobDescription}] Tidak ada sesi untuk dihitung ulang.`
        );
        notifyUser('recalculation:success', {
          message: 'Tidak ada data ringkasan yang perlu diklasifikasi ulang.',
          processed: 0,
          total: 0,
        });
        return;
      }

      const totalSummaries = summariesToReclassify.length;
      console.log(
        `[BACKGROUND JOB - ${jobDescription}] Ditemukan ${totalSummaries} ringkasan untuk diklasifikasi ulang.`
      );

      for (let i = 0; i < totalSummaries; i++) {
        const summary = summariesToReclassify[i];
        const progress = { processed: i + 1, total: totalSummaries };

        notifyUser('recalculation:progress', progress);

        await _classifyDailyUsage(summary, summary.meter);
      }

      console.log(
        `[BACKGROUND JOB - ${jobDescription}] Kalkulasi ulang selesai dengan sukses.`
      );
      notifyUser('recalculation:success', {
        message: `Klasifikasi ulang berhasil untuk ${totalSummaries} data.`,
        processed: totalSummaries,
        total: totalSummaries,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[BACKGROUND JOB - ${jobDescription}] Error:`,
        errorMessage
      );
      notifyUser('recalculation:error', { message: errorMessage });

      const superAdmins = await this._prisma.user.findMany({
        where: {
          role: { role_name: 'SuperAdmin' },
          is_active: true,
        },
        select: { user_id: true },
      });

      for (const admin of superAdmins) {
        await notificationService.create({
          user_id: admin.user_id,
          title: 'Error: Kalkulasi Ulang Gagal',
          message: `Proses kalkulasi ulang data gagal. Error: ${errorMessage}`,
        });
      }
    }
  }
}
export const recapService = new RecapService();
