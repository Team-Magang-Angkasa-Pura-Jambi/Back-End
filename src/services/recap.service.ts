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

  public async getRecap(query: GetRecapQuery): Promise<RecapApiResponse> {
    const { energyType, sortBy, sortOrder, meterId } = query;
    let { startDate, endDate } = query;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (endDate >= today) {
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      endDate = new Date(
        Date.UTC(
          yesterday.getUTCFullYear(),
          yesterday.getUTCMonth(),
          yesterday.getUTCDate(),
          23,
          59,
          59,
          999
        )
      );
    }

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

      const fuelSummary = this._calculateSummary(fuelData, new Map(), 'Fuel');
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

      const [summaries, paxData, efficiencyTargets, weatherHistories] =
        await Promise.all([
          this._prisma.dailySummary.findMany({
            where: whereClause,

            select: {
              summary_date: true,
              total_cost: true,
              total_consumption: true,
              meter: {
                include: {
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
        ]);

      const aggregatedSummaries = new Map<string, AggregatedDailyData>();
      for (const summary of summaries) {
        const dateString = summary.summary_date.toISOString().split('T')[0];
        const currentData = aggregatedSummaries.get(dateString) ?? {
          costBeforeTax: 0,
          costWithTax: 0,
          wbp: 0,
          lwbp: 0,
          consumption: 0,
        };

        const costBeforeTax = summary.total_cost?.toNumber() ?? 0;

        const relevantPriceScheme =
          summary.meter.tariff_group.price_schemes.find(
            (ps) => ps.effective_date <= summary.summary_date && ps.is_active
          );

        const totalTaxRate =
          relevantPriceScheme?.taxes.reduce(
            (acc, taxOnScheme) => acc + (taxOnScheme.tax.rate.toNumber() ?? 0),
            0
          ) ?? 0;

        const taxAmount = costBeforeTax * totalTaxRate;
        const costWithTax = costBeforeTax + taxAmount;

        currentData.costBeforeTax += costBeforeTax;
        currentData.costWithTax += costWithTax;

        if (energyType === 'Electricity') {
          const wbpDetail = summary.details.find(
            (d) => d.metric_name === 'Pemakaian WBP'
          );
          const lwbpDetail = summary.details.find(
            (d) => d.metric_name === 'Pemakaian LWBP'
          );

          currentData.wbp += wbpDetail?.consumption_value.toNumber() ?? 0;
          currentData.lwbp += lwbpDetail?.consumption_value.toNumber() ?? 0;

          currentData.consumption += summary.total_consumption?.toNumber() ?? 0;
        } else {
          currentData.consumption += summary.total_consumption?.toNumber() ?? 0;
        }

        aggregatedSummaries.set(dateString, currentData);
      }

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

      const data: RecapDataRow[] = [];
      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const currentDate = new Date(d);
        const dateString = currentDate.toISOString().split('T')[0];
        const summaryForDay = aggregatedSummaries.get(dateString);
        const paxForDay = paxDataMap.get(dateString) ?? null;
        const weatherForDay = weatherDataMap.get(dateString);

        const targetRecord = efficiencyTargets.find(
          (t) => currentDate >= t.period_start && currentDate <= t.period_end
        );
        const targetForDay = targetRecord
          ? targetRecord.target_value.toNumber()
          : null;

        const summaryForDate = summaries.find(
          (s) => s.summary_date.toISOString().split('T')[0] === dateString
        );

        const dayOfWeek = currentDate.getDay();
        const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;

        data.push({
          date: currentDate,
          wbp: summaryForDay?.wbp ?? null,
          lwbp: summaryForDay?.lwbp ?? null,
          consumption: summaryForDay?.consumption ?? null,
          classification:
            summaryForDate?.classification?.classification ?? null,
          confidence_score:
            summaryForDate?.classification?.confidence_score ?? null,
          target: targetForDay,
          pax: paxForDay,

          cost: summaryForDay?.costBeforeTax ?? null,

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

      const summary = this._calculateSummary(
        data,
        aggregatedSummaries,
        energyType
      );

      return { data, meta: summary };
    });
  }

  /**
   * Menghitung total ringkasan akhir dari data rekap yang sudah diproses.
   */
  private _calculateSummary(
    data: RecapDataRow[],
    aggregatedData: Map<string, AggregatedDailyData>,
    energyType: 'Electricity' | 'Water' | 'Fuel'
  ): RecapSummary {
    let totalCost = 0;
    let totalCostBeforeTax = 0;
    let totalWbp = 0;
    let totalLwbp = 0;
    let totalConsumption = 0;
    let totalPax = 0;

    for (const row of data) {
      const summary = aggregatedData.get(row.date.toISOString().split('T')[0]);
      totalCost += summary?.costWithTax ?? 0;
      totalCostBeforeTax += summary?.costBeforeTax ?? 0;

      if (energyType === 'Electricity') {
        totalWbp += row.wbp ?? 0;
        totalLwbp += row.lwbp ?? 0;
      }

      totalConsumption += row.consumption ?? 0;
      totalPax += row.pax ?? 0;
    }

    return {
      totalCost,
      totalCostBeforeTax,
      totalTarget: data.reduce((sum, row) => sum + (row.target ?? 0), 0),
      totalConsumption,
      totalWbp,
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
