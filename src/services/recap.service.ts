import prisma from '../configs/db.js';

import { Prisma } from '../generated/prisma/index.js';
import type {
  GetRecapQuery,
  RecapApiResponse,
  RecapDataRow,
  RecapSummary,
} from '../types/recap.types.js';
import { notificationService } from './notification.service.js';
import { BaseService } from '../utils/baseService.js';
import { SocketServer } from '../configs/socket.js';

type AggregatedDailyData = {
  costBeforeTax: number;
  costWithTax: number;
  wbp: number;
  lwbp: number;
  consumption: number;
};

export class RecapService extends BaseService {
  constructor() {
    super(prisma);
  }

  /**
   * BARU: Menghitung dan mengembalikan ringkasan data bulanan secara agregat.
   * @param query - Berisi tahun, bulan, dan filter opsional.
   */
  public async getMonthlyRecap(query: GetRecapQuery) {
    const { year, month } = query;

    const currentStartDate = new Date(Date.UTC(year, month - 1, 1));
    const currentEndDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const previousMonthDate = new Date(currentStartDate);
    previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth() - 1);
    const prevStartDate = new Date(
      Date.UTC(
        previousMonthDate.getUTCFullYear(),
        previousMonthDate.getUTCMonth(),
        1
      )
    );
    const prevEndDate = new Date(
      Date.UTC(
        previousMonthDate.getUTCFullYear(),
        previousMonthDate.getUTCMonth() + 1,
        0,
        23,
        59,
        59,
        999
      )
    );

    const [currentData, previousData] = await Promise.all([
      this._getAggregatedDataForPeriod(currentStartDate, currentEndDate, query),
      this._getAggregatedDataForPeriod(prevStartDate, prevEndDate, query),
    ]);

    return {
      total_consumption: {
        currentValue: currentData.total_consumption,
        previousValue: previousData.total_consumption,
        percentageChange: this._calculatePercentageChange(
          currentData.total_consumption,
          previousData.total_consumption
        ),
      },
      total_cost: {
        currentValue: currentData.total_cost,
        previousValue: previousData.total_cost,
        percentageChange: this._calculatePercentageChange(
          currentData.total_cost,
          previousData.total_cost
        ),
      },
      total_target_consumption: {
        currentValue: currentData.total_target_consumption,
        previousValue: previousData.total_target_consumption,
        percentageChange: this._calculatePercentageChange(
          currentData.total_target_consumption,
          previousData.total_target_consumption
        ),
      },
      total_target_cost: {
        currentValue: currentData.total_target_cost,
        previousValue: previousData.total_target_cost,
        percentageChange: this._calculatePercentageChange(
          currentData.total_target_cost,
          previousData.total_target_cost
        ),
      },
      total_pax: {
        currentValue: currentData.total_pax,
        previousValue: previousData.total_pax,
        percentageChange: this._calculatePercentageChange(
          currentData.total_pax,
          previousData.total_pax
        ),
      },
    };
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
            // Hitung target hanya pada hari-hari dalam periode
            // Ini adalah pendekatan sederhana; bisa disempurnakan jika target tidak harian
            period_start: { lte: endDate },
            period_end: { gte: startDate },
          },
        }),
      ]);

    // Untuk target, kita perlu menghitung jumlah hari irisan
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

    // if (endDate >= today) {
    //   const yesterday = new Date(today);
    //   yesterday.setUTCDate(yesterday.getUTCDate());
    //   endDate = new Date(
    //     Date.UTC(
    //       yesterday.getUTCFullYear(),
    //       yesterday.getUTCMonth(),
    //       yesterday.getUTCDate(),
    //       0,
    //       0,
    //       0,
    //       0
    //     )
    //   );
    // }

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
              // PERBAIKAN: Ganti 'include' menjadi 'select' untuk bisa memilih field spesifik
              select: {
                meter_id: true, // Diperlukan untuk pemetaan nanti
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
        paxData.map((p) => [
          p.data_date.toISOString().split('T')[0],
          p.total_pax,
        ])
      );

      const weatherDataMap = new Map(
        weatherHistories.map((w) => [
          w.data_date.toISOString().split('T')[0],
          { avg_temp: w.avg_temp, max_temp: w.max_temp },
        ])
      );

      const predictionsMap = new Map(
        predictions.map((p) => [
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
          (t) => currentDate >= t.period_start && currentDate <= t.period_end
        );
        const targetForDay = targetRecord
          ? targetRecord.target_value.toNumber()
          : null;

        // PERBAIKAN: Ambil data langsung dari `summaries` yang sudah difilter per tanggal.
        const summaryForDate = summaries.filter(
          (s) => s.summary_date.toISOString().split('T')[0] === dateString
        );

        const dayOfWeek = currentDate.getDay();
        const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;

        // Kalkulasi WBP, LWBP, dan konsumsi dari detail yang sudah ada.
        const wbp =
          summaryForDate
            .flatMap((s) => s.details)
            .find((d) => d.metric_name === 'Pemakaian WBP')
            ?.consumption_value?.toNumber() ?? null;
        const lwbp =
          summaryForDate
            .flatMap((s) => s.details)
            .find((d) => d.metric_name === 'Pemakaian LWBP')
            ?.consumption_value?.toNumber() ?? null;
        const consumption =
          summaryForDate.reduce(
            (sum, s) => sum + (s.total_consumption?.toNumber() ?? 0),
            0
          ) || null;
        const cost =
          summaryForDate.reduce(
            (sum, s) => sum + (s.total_cost?.toNumber() ?? 0),
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
    const totalPax = data.reduce((sum, row) => sum + (row.pax ?? 0), 0);

    if (energyType === 'Electricity') {
      if (energyType === 'Electricity') {
        totalWbp = data.reduce((sum, row) => sum + (row.wbp ?? 0), 0);
        totalLwbp = data.reduce((sum, row) => sum + (row.lwbp ?? 0), 0);
      }
    }

    return {
      totalCost,
      // PERBAIKAN: Gunakan `totalCost` karena ini adalah biaya sebelum pajak dari DailySummary.
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

    const notifyUser = (event: string, data: unknown) => {
      if (userId) {
        SocketServer.instance.io.to(String(userId)).emit(event, data);
      }
    };

    try {
      // PERBAIKAN: Logika diubah untuk mencari DailySummary, bukan ReadingSession.
      // Ini memungkinkan klasifikasi ulang untuk data historis yang tidak memiliki sesi.
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

      // PERBAIKAN: Impor ReadingService sekali di luar loop.
      const { ReadingService } = await import('./reading.service.js');
      const readingService = new ReadingService();

      for (let i = 0; i < totalSummaries; i++) {
        const summary = summariesToReclassify[i];
        const progress = { processed: i + 1, total: totalSummaries };

        notifyUser('recalculation:progress', progress);

        // PERBAIKAN: Panggil langsung fungsi klasifikasi.
        // Kita tidak perlu `processAndSummarizeReading` lagi karena summary sudah ada.
        // @ts-ignore - Memanggil metode privat untuk tujuan ini.
        await readingService._classifyDailyUsage(summary, summary.meter);
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
