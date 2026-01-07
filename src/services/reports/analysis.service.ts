import prisma from '../../configs/db.js';
import { Prisma, UsageCategory } from '../../generated/prisma/index.js';
import type {
  GetAnalysisQuery,
  DailyAnalysisRecord,
} from '../../types/reports/analysis.types.js';
import { Error400, Error404 } from '../../utils/customError.js';
import { BaseService } from '../../utils/baseService.js';
import { weatherService } from '../weather.service.js';
import { differenceInDays } from 'date-fns';
import { _classifyDailyUsage } from '../metering/helpers/forecast-calculator.js';
import { machineLearningService } from '../intelligence/machineLearning.service.js';

export type ClassificationSummary = {
  [key in UsageCategory]?: number;
} & {
  totalDaysInMonth: number;
  totalDaysWithData: number;
  totalDaysWithClassification: number;
};

type ElectricityClassificationSummary = {
  terminal: ClassificationSummary;
  kantor: ClassificationSummary;
};

type MonthlyBudgetAllocation = {
  month: number;
  monthName: string;
  allocatedBudget: number;
  realizationCost: number;
  remainingBudget: number;
  realizationPercentage: number | null;
};

type BudgetSummaryByEnergy = {
  energyTypeId: number;
  energyTypeName: string;
  budgetThisYear: number;
  currentPeriod: {
    budgetId: number;
    periodStart: Date;
    periodEnd: Date;
    totalBudget: number;
    totalRealization: number;
    remainingBudget: number;
    realizationPercentage: number | null;
  } | null;
};

type MeterAnalysisData = {
  meterId: number;
  meterName: string;
  data: DailyAnalysisRecord[];
};

type FuelStockSummaryRecord = {
  meterId: number;
  meterName: string;
  remaining_stock: number | null;
  percentage: number | null;
  tank_volume: number | null;
  last_reading_date: Date | null;
};

type TodaySummaryResponse = {
  meta: {
    date: Date;
    pax: number | null;
  };
  data: Prisma.DailySummaryGetPayload<{
    include: {
      meter: {
        select: {
          meter_code: true;
          energy_type: {
            select: { type_name: true; unit_of_measurement: true };
          };
        };
      };
      classification: { select: { classification: true } };
    };
  }>[];
};
type bodyRunBulkPrediction = {
  startDate: Date;
  endDate: Date;
  userId: number;
};

export class AnalysisService extends BaseService {
  constructor() {
    super(prisma);
  }

  public async getMonthlyAnalysis(
    query: GetAnalysisQuery
  ): Promise<MeterAnalysisData[]> {
    const { energyType, month: monthString, meterId } = query;

    const [year, month] = monthString.split('-').map(Number);
    const monthIndex = month - 1;

    const startDate = new Date(Date.UTC(year, monthIndex, 1));

    const endDate = new Date(
      Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)
    );

    const energyTypeRecord = await prisma.energyType.findUnique({
      where: { type_name: energyType },
    });
    if (!energyTypeRecord) {
      throw new Error(`Tipe energi '${energyType}' tidak ditemukan.`);
    }

    const whereClause: Prisma.DailySummaryWhereInput = {
      meter: {
        energy_type_id: energyTypeRecord.energy_type_id,
        ...(meterId && { meter_id: meterId }),
      },
      summary_date: { gte: startDate, lte: endDate },
    };

    const summaries = await prisma.dailySummary.findMany({
      where: whereClause,
      include: {
        meter: true,
        classification: true,
      },
    });

    const targets = await prisma.efficiencyTarget.findMany({
      where: {
        meter: {
          energy_type_id: energyTypeRecord.energy_type_id,
          ...(meterId && { meter_id: meterId }),
        },
        period_start: { lte: endDate },
        period_end: { gte: startDate },
      },
    });

    const targetsByMeter = new Map<
      number,
      { value: number | null; cost: number | null }
    >();
    for (const target of targets) {
      targetsByMeter.set(target.meter_id, {
        value: parseFloat(target.target_value.toString()),
        cost: target.target_cost
          ? parseFloat(target.target_cost.toString())
          : null,
      });
    }

    const predictions = await prisma.consumptionPrediction.findMany({
      where: {
        meter: {
          energy_type_id: energyTypeRecord.energy_type_id,
          ...(meterId && { meter_id: meterId }),
        },
        prediction_date: { gte: startDate, lte: endDate },
      },
    });

    const dataByMeter = new Map<
      number,
      {
        meterName: string;
        dailyData: Map<string, Partial<DailyAnalysisRecord>>;
      }
    >();

    for (const summary of summaries) {
      const meterId = summary.meter_id;
      const meterName = summary.meter.meter_code;
      const dateString = summary.summary_date.toISOString().split('T')[0];

      if (!dataByMeter.has(meterId)) {
        dataByMeter.set(meterId, { meterName, dailyData: new Map() });
      }

      const totalConsumption = summary.total_consumption?.toNumber() ?? null;

      const dayData = dataByMeter.get(meterId)!.dailyData.get(dateString) || {};
      dayData.actual_consumption = totalConsumption;

      dayData.consumption_cost = summary.total_cost?.toNumber() ?? null;
      dayData.classification = summary.classification?.classification ?? null;
      dayData.confidence_score =
        summary.classification?.confidence_score ?? null;
      dataByMeter.get(meterId)!.dailyData.set(dateString, dayData);
    }

    for (const prediction of predictions) {
      const meterId = prediction.meter_id;
      const dateString = prediction.prediction_date.toISOString().split('T')[0];

      if (dataByMeter.has(meterId)) {
        const dayData =
          dataByMeter.get(meterId)!.dailyData.get(dateString) || {};
        dayData.prediction = parseFloat(prediction.predicted_value.toString());
        dataByMeter.get(meterId)!.dailyData.set(dateString, dayData);
      }
    }

    const finalResults: MeterAnalysisData[] = [];

    for (const [meterId, meterInfo] of dataByMeter.entries()) {
      const timeSeries: DailyAnalysisRecord[] = [];

      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        const currentDate = new Date(d);
        const dateString = currentDate.toISOString().split('T')[0];

        const dayData = meterInfo.dailyData.get(dateString);

        timeSeries.push({
          date: currentDate,
          actual_consumption: dayData?.actual_consumption ?? null,
          consumption_cost: dayData?.consumption_cost ?? null,
          prediction: dayData?.prediction ?? null,
          classification: dayData?.classification ?? null,
          confidence_score: dayData?.confidence_score ?? null,
          efficiency_target: targetsByMeter.get(meterId)?.value ?? null,
          efficiency_target_cost: targetsByMeter.get(meterId)?.cost ?? null,
        });
      }

      finalResults.push({
        meterId,
        meterName: meterInfo.meterName,
        data: timeSeries,
      });
    }

    return finalResults;
  }

  /**
   * BARU: Menganalisis sisa stok BBM harian untuk semua meter BBM dalam satu bulan.
   * @param query - Berisi bulan yang akan dianalisis (format YYYY-MM).
   */
  public async getMonthlyFuelStockAnalysis(
    query: Pick<GetAnalysisQuery, 'month'>
  ): Promise<FuelStockSummaryRecord[]> {
    const { month: monthString } = query;

    const [year, month] = monthString.split('-').map(Number);
    const monthIndex = month - 1;
    const endDate = new Date(
      Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)
    );

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
        percentage = parseFloat(
          ((remainingStock / tankVolume) * 100).toFixed(2)
        );
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

  /**
   * BARU: Menghitung ringkasan jumlah klasifikasi (BOROS, HEMAT, NORMAL)
   * untuk periode dan filter yang diberikan.
   */
  public async getClassificationSummary(
    query: Omit<GetAnalysisQuery, 'energyType' | 'meterId'>
  ): Promise<ElectricityClassificationSummary> {
    const { month } = query;

    const targetDate = month
      ? new Date(`${month}-01T00:00:00.000Z`)
      : new Date();
    const year = targetDate.getUTCFullYear();
    const monthIndex = targetDate.getUTCMonth();

    const startDate = new Date(Date.UTC(year, monthIndex, 1));
    const endDate = new Date(
      Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)
    );

    const totalDaysInMonth = endDate.getUTCDate();

    const [terminalMeter, kantorMeter] = await Promise.all([
      prisma.meter.findUnique({ where: { meter_code: 'ELEC-TERM-01' } }),
      prisma.meter.findUnique({ where: { meter_code: 'ELEC-KANTOR-01' } }),
    ]);

    if (!terminalMeter || !kantorMeter) {
      throw new Error404(
        'Meteran listrik untuk Terminal atau Kantor tidak ditemukan. Pastikan meter dengan kode ELEC-TERM-01 dan ELEC-KANTOR-01 ada.'
      );
    }

    const [terminalSummary, kantorSummary] = await Promise.all([
      this._getSummaryForMeter(terminalMeter.meter_id, startDate, endDate),
      this._getSummaryForMeter(kantorMeter.meter_id, startDate, endDate),
    ]);

    return {
      terminal: { ...terminalSummary, totalDaysInMonth },
      kantor: { ...kantorSummary, totalDaysInMonth },
    };
  }

  /**
   * Helper privat untuk menghitung ringkasan klasifikasi untuk satu meter.
   * @param meterId - ID meter yang akan dianalisis.
   * @param startDate - Tanggal mulai periode.
   * @param endDate - Tanggal akhir periode.
   * @returns Objek ClassificationSummary tanpa totalDaysInMonth.
   */
  private async _getSummaryForMeter(
    meterId: number,
    startDate: Date,
    endDate: Date
  ): Promise<Omit<ClassificationSummary, 'totalDaysInMonth'>> {
    const [groupedData, distinctDaysWithData] = await Promise.all([
      prisma.dailyUsageClassification.groupBy({
        by: ['classification'],
        where: {
          meter_id: meterId,
          classification_date: { gte: startDate, lte: endDate },
          classification: {
            in: [
              UsageCategory.BOROS,
              UsageCategory.HEMAT,
              UsageCategory.NORMAL,
            ],
          },
        },
        _count: { classification: true },
      }),
      prisma.dailySummary.count({
        where: {
          meter_id: meterId,
          summary_date: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    const summary: Omit<ClassificationSummary, 'totalDaysInMonth'> = {
      totalDaysWithData: distinctDaysWithData,
      totalDaysWithClassification: 0,
      BOROS: 0,
      HEMAT: 0,
      NORMAL: 0,
    };

    let totalClassifiedDays = 0;
    for (const group of groupedData) {
      const count = group._count.classification;
      if (group.classification) {
        summary[group.classification] = count;
      }
      totalClassifiedDays += count;
    }
    summary.totalDaysWithClassification = totalClassifiedDays;

    return summary;
  }

  /**
   * BARU: Mengambil ringkasan konsumsi untuk hari ini.
   * @param energyType - (Opsional) Filter berdasarkan tipe energi.
   */
  public async getTodaySummary(
    energyType?: 'Electricity' | 'Water' | 'Fuel'
  ): Promise<TodaySummaryResponse> {
    const todayInJakarta = new Date();
    const year = todayInJakarta.toLocaleString('en-CA', {
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    });
    const month = todayInJakarta.toLocaleString('en-CA', {
      month: '2-digit',
      timeZone: 'Asia/Jakarta',
    });
    const day = todayInJakarta.toLocaleString('en-CA', {
      day: '2-digit',
      timeZone: 'Asia/Jakarta',
    });
    const dateString = `${year}-${month}-${day}`;

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

    return {
      meta: {
        date: today,
        pax: paxData?.total_pax ?? null,
      },
      data: todaySummaries,
    };
  }

  /**
   * BARU: Menjalankan prediksi secara massal untuk rentang tanggal tertentu.
   * Ini berjalan sebagai background job dan memberikan notifikasi via socket.
   * @param body - Berisi startDate, endDate, dan userId untuk notifikasi.
   */

  public async runBulkPredictions(body: bodyRunBulkPrediction): Promise<void> {
    const { startDate, endDate, userId } = body;
    const jobDescription = `bulk-predict-${userId}-${Date.now()}`;

    console.log(
      `[BACKGROUND JOB - ${jobDescription}] Memulai prediksi massal dari ${startDate.toISOString()} hingga ${endDate.toISOString()}`
    );

    const notifyUser = (event: string, data: unknown) => {
      if (userId) {
        prisma.user.findUnique({ where: { user_id: userId } }).then((user) => {
          if (user) {
            console.log(`NOTIFY ${userId}: ${event}`, data);
          }
        });
      }
    };

    try {
      const datesToProcess = [];
      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        datesToProcess.push(new Date(d));
      }

      if (datesToProcess.length === 0) {
        notifyUser('prediction:success', {
          message: 'Tidak ada tanggal untuk diproses.',
        });
        return;
      }

      const totalDays = datesToProcess.length;
      let processedCount = 0;

      for (const currentDate of datesToProcess) {
        const predictionDate = new Date(currentDate);
        predictionDate.setUTCDate(currentDate.getUTCDate() + 1);

        await this.runPredictionForDate(currentDate);

        processedCount++;
        notifyUser('prediction:progress', {
          processed: processedCount,
          total: totalDays,
        });
      }

      notifyUser('prediction:success', {
        message: `Prediksi massal selesai. ${processedCount} hari diproses.`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[BACKGROUND JOB - ${jobDescription}] Error:`,
        errorMessage
      );
      notifyUser('prediction:error', { message: errorMessage });
    }
  }

  /**
   * BARU: Logika terpusat untuk menjalankan prediksi untuk H+1 berdasarkan data di `baseDate`.
   * Bisa dipanggil dari cron, bulk process, atau trigger lain.
   * @param baseDate - Tanggal yang datanya akan digunakan sebagai dasar prediksi.
   */
  public async runPredictionForDate(
    baseDate: Date,
    targetMeterId?: number
  ): Promise<void> {
    const [terminalMeter, kantorMeter] = await Promise.all([
      prisma.meter.findUnique({ where: { meter_code: 'ELEC-TERM-01' } }),
      prisma.meter.findUnique({ where: { meter_code: 'ELEC-KANTOR-01' } }),
    ]);

    if (!terminalMeter || !kantorMeter) {
      console.error(
        '[Prediction] Gagal menemukan meter ELEC-TERM-01 atau ELEC-KANTOR-01.'
      );
      return;
    }

    if (
      targetMeterId &&
      targetMeterId !== terminalMeter.meter_id &&
      targetMeterId !== kantorMeter.meter_id
    ) {
      console.error(
        `[Prediction] Prediksi tunggal hanya didukung untuk meter Terminal (${terminalMeter.meter_id}) atau Kantor (${kantorMeter.meter_id}). ID yang diberikan: ${targetMeterId}`
      );
      return;
    }
    const modelVersion = 'pax-integrated-v3.1';

    const predictionDate = new Date(baseDate);

    const predictionDateStr = baseDate.toISOString().split('T')[0];

    try {
      const weatherDataFromService =
        await weatherService.getForecast(predictionDate);
      const weatherData = {
        suhu_rata: weatherDataFromService?.suhu_rata ?? 28.0,
        suhu_max: weatherDataFromService?.suhu_max ?? 32.0,
      };

      console.log(
        `[Prediction] Menjalankan prediksi untuk ${predictionDateStr}...`
      );

      const predictionsToRun = [];

      if (!targetMeterId || targetMeterId === terminalMeter.meter_id) {
        predictionsToRun.push(
          this._runTerminalPrediction(
            predictionDate,
            terminalMeter.meter_id,
            modelVersion,
            weatherData
          )
        );
      }
      if (!targetMeterId || targetMeterId === kantorMeter.meter_id) {
        predictionsToRun.push(
          this._runKantorPrediction(
            predictionDate,
            kantorMeter.meter_id,
            modelVersion,
            weatherData
          )
        );
      }

      await Promise.all(predictionsToRun);
    } catch (error) {
      console.error(
        `[Prediction] Gagal menjalankan prediksi untuk ${predictionDateStr}:`,
        error
      );
    }
  }

  private async _runTerminalPrediction(
    predictionDate: Date,
    meterId: number,
    modelVersion: string,
    weatherData: { suhu_rata: number; suhu_max: number }
  ) {
    const predictionResult = await machineLearningService.getTerminalPrediction(
      predictionDate,
      weatherData
    );
    if (predictionResult) {
      await prisma.consumptionPrediction.upsert({
        where: {
          prediction_date_meter_id_model_version: {
            prediction_date: predictionDate,
            meter_id: meterId,
            model_version: modelVersion,
          },
        },
        update: {
          predicted_value: predictionResult.prediksi_kwh_terminal,
        },
        create: {
          prediction_date: predictionDate,
          predicted_value: predictionResult.prediksi_kwh_terminal,
          meter_id: meterId,
          model_version: modelVersion,
        },
      });
      console.log(
        `[Prediction] Hasil prediksi Terminal untuk ${predictionDate.toISOString().split('T')[0]} berhasil disimpan.`
      );
    }
  }

  private async _runKantorPrediction(
    predictionDate: Date,
    meterId: number,
    modelVersion: string,
    weatherData: { suhu_rata: number; suhu_max: number }
  ) {
    const predictionResult = await machineLearningService.getKantorPrediction(
      predictionDate,
      weatherData
    );
    if (predictionResult) {
      await prisma.consumptionPrediction.upsert({
        where: {
          prediction_date_meter_id_model_version: {
            prediction_date: predictionDate,
            meter_id: meterId,
            model_version: modelVersion,
          },
        },
        update: { predicted_value: predictionResult.prediksi_kwh_kantor },
        create: {
          prediction_date: predictionDate,
          predicted_value: predictionResult.prediksi_kwh_kantor,
          meter_id: meterId,
          model_version: modelVersion,
        },
      });
      console.log(
        `[Prediction] Hasil prediksi Kantor untuk ${predictionDate.toISOString().split('T')[0]} berhasil disimpan.`
      );
    }
  }

  /**
   * BARU: Menghitung alokasi anggaran tahunan dan membandingkannya dengan realisasi bulanan.
   * @param year - Tahun yang akan dianalisis.
   */
  public async getBudgetAllocation(
    year: number
  ): Promise<MonthlyBudgetAllocation[]> {
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
      throw new Error404(
        `Tidak ada data anggaran yang ditemukan untuk tahun ${year}.`
      );
    }

    const monthlyAllocations: MonthlyBudgetAllocation[] = Array.from(
      { length: 12 },
      (_, i) => ({
        month: i + 1,
        monthName: new Date(Date.UTC(year, i, 1)).toLocaleString('id-ID', {
          month: 'long',
        }),
        allocatedBudget: 0,
        realizationCost: 0,
        remainingBudget: 0,
        realizationPercentage: 0,
      })
    );

    for (const budget of budgetPeriods) {
      const periodDays =
        (budget.period_end.getTime() - budget.period_start.getTime()) /
          (1000 * 60 * 60 * 24) +
        1;
      if (periodDays <= 0) continue;

      const budgetPerDay = budget.total_budget.dividedBy(periodDays);

      for (let i = 0; i < 12; i++) {
        const monthStartDate = new Date(Date.UTC(year, i, 1));
        const monthEndDate = new Date(Date.UTC(year, i + 1, 0));

        const overlapStart = new Date(
          Math.max(monthStartDate.getTime(), budget.period_start.getTime())
        );
        const overlapEnd = new Date(
          Math.min(monthEndDate.getTime(), budget.period_end.getTime())
        );

        if (overlapEnd >= overlapStart) {
          const daysInMonthOverlap =
            (overlapEnd.getTime() - overlapStart.getTime()) /
              (1000 * 60 * 60 * 24) +
            1;
          const budgetForMonth = budgetPerDay.times(daysInMonthOverlap);
          monthlyAllocations[i].allocatedBudget += budgetForMonth.toNumber();
        }
      }
    }

    const realizationResult = await prisma.$queryRaw<
      { month: number; total_cost: number }[]
    >(
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
    `
    );

    for (const realization of realizationResult) {
      const monthIndex = realization.month - 1;
      if (monthlyAllocations[monthIndex]) {
        monthlyAllocations[monthIndex].realizationCost = Number(
          realization.total_cost
        );
      }
    }

    for (const allocation of monthlyAllocations) {
      allocation.remainingBudget =
        allocation.allocatedBudget - allocation.realizationCost;
      if (allocation.allocatedBudget > 0) {
        allocation.realizationPercentage = parseFloat(
          (
            (allocation.realizationCost / allocation.allocatedBudget) *
            100
          ).toFixed(2)
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
  }): Promise<{
    monthlyAllocation: Omit<
      MonthlyBudgetAllocation,
      | 'realizationCost'
      | 'remainingBudget'
      | 'realizationPercentage'
      | 'monthName'
    >[];
    meterAllocationPreview: {
      meterId: number;
      meterName: string;
      allocatedBudget: number;
      dailyBudgetAllocation: number;
      estimatedDailyKwh: number;
    }[];
    calculationDetails: {
      parentTotalBudget: number;
      efficiencyBudget: number;
      realizationToDate: number;
      remainingBudgetForPeriod: number;
      budgetPerMonth: number;
      suggestedBudgetForPeriod: number;
    };
  }> {
    const { parent_budget_id, period_start, period_end, allocations } =
      budgetData;

    const parentBudget = await this._prisma.annualBudget.findUnique({
      where: { budget_id: parent_budget_id },
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

    if (!parentBudget) {
      throw new Error404(
        `Anggaran induk dengan ID ${parent_budget_id} tidak ditemukan.`
      );
    }

    const efficiencyTag = parentBudget.efficiency_tag ?? new Prisma.Decimal(1);
    const efficiencyBudget = parentBudget.total_budget.times(efficiencyTag);

    const realizationEndDate = new Date(period_start);
    realizationEndDate.setUTCDate(realizationEndDate.getUTCDate() - 1);

    console.log('--- DEBUG: Menghitung Realisasi Anggaran ---');
    console.log('Periode Anggaran Induk:', {
      start: parentBudget.period_start.toISOString(),
      end: parentBudget.period_end.toISOString(),
    });
    console.log(
      'Periode Realisasi Dihitung Hingga:',
      realizationEndDate.toISOString()
    );

    let realizationToDate = new Prisma.Decimal(0);

    for (const child of parentBudget.child_budgets as Prisma.AnnualBudgetGetPayload<{
      include: { allocations: { select: { meter_id: true } } };
    }>[]) {
      const childMeterIds = child.allocations.map((a) => a.meter_id);
      if (childMeterIds.length > 0) {
        const effectiveEndDate =
          realizationEndDate < child.period_end
            ? realizationEndDate
            : child.period_end;

        const childRealizationResult =
          await this._prisma.dailySummary.aggregate({
            _sum: { total_cost: true },
            where: {
              meter_id: { in: childMeterIds },
              summary_date: {
                gte: child.period_start,
                lte: effectiveEndDate,
              },
            },
          });
        realizationToDate = realizationToDate.plus(
          childRealizationResult._sum.total_cost ?? new Prisma.Decimal(0)
        );
      }
    }
    console.log('Nilai Akhir realizationToDate:', realizationToDate.toNumber());

    const remainingBudgetForPeriod = efficiencyBudget.minus(realizationToDate);

    let suggestedBudgetForPeriod: Prisma.Decimal;

    const periodMonths =
      (period_end.getUTCFullYear() - period_start.getUTCFullYear()) * 12 +
      (period_end.getUTCMonth() - period_start.getUTCMonth()) +
      1;

    console.log('Panjang Periode (bulan):', periodMonths);

    if (periodMonths <= 0) {
      throw new Error400('Periode tidak valid.');
    }

    let budgetPerMonth: Prisma.Decimal;
    if (parentBudget.child_budgets.length === 0) {
      budgetPerMonth = parentBudget.total_budget.div(12);
    } else {
      budgetPerMonth = remainingBudgetForPeriod.div(periodMonths);
    }

    if (realizationToDate.isZero()) {
      suggestedBudgetForPeriod = efficiencyBudget;
    } else {
      suggestedBudgetForPeriod = remainingBudgetForPeriod;
    }

    const monthlyAllocation: Omit<
      MonthlyBudgetAllocation,
      | 'realizationCost'
      | 'remainingBudget'
      | 'realizationPercentage'
      | 'monthName'
    >[] = [];
    for (
      let d = new Date(period_start);
      d <= period_end;
      d.setUTCMonth(d.getUTCMonth() + 1)
    ) {
      monthlyAllocation.push({
        month: d.getUTCMonth() + 1,
        allocatedBudget: budgetPerMonth.toNumber(),
      });
    }

    const meterAllocationPreview: {
      meterId: number;
      meterName: string;
      allocatedBudget: number;
      dailyBudgetAllocation: number;
      estimatedDailyKwh: number;
    }[] = [];

    if (allocations && allocations.length > 0) {
      const periodDays =
        (period_end.getTime() - period_start.getTime()) /
          (1000 * 60 * 60 * 24) +
        1;

      for (const alloc of allocations) {
        const allocatedBudget = remainingBudgetForPeriod.times(alloc.weight);
        const dailyBudgetAllocation = allocatedBudget.div(periodDays);

        meterAllocationPreview.push({
          meterId: alloc.meter_id,
          meterName: `Meter ${alloc.meter_id}`,
          allocatedBudget: allocatedBudget.toNumber(),
          dailyBudgetAllocation: dailyBudgetAllocation.toNumber(),
          estimatedDailyKwh: 0,
        });
      }
    }

    return {
      monthlyAllocation,
      meterAllocationPreview,
      calculationDetails: {
        parentTotalBudget: parentBudget.total_budget.toNumber(),
        efficiencyBudget: efficiencyBudget.toNumber(),
        realizationToDate: realizationToDate.toNumber(),
        remainingBudgetForPeriod: remainingBudgetForPeriod.toNumber(),
        budgetPerMonth: budgetPerMonth.toNumber(),
        suggestedBudgetForPeriod: suggestedBudgetForPeriod.toNumber(),
      },
    };
  }

  /**
   * BARU: Mendapatkan ringkasan anggaran (tahunan, periode ini, realisasi)
   * yang dikelompokkan per jenis energi.
   */
  public async getBudgetSummary(year: number) {
    // 1. Terima parameter tahun
    // 2. Tentukan Range Tanggal (1 Jan - 31 Des tahun tersebut)
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    // 3. Ambil Parent Annual Budgets untuk tahun tersebut
    // Kita include allocations melalui child_budgets untuk tahu meter mana saja yang dipakai
    const parentBudgets = await prisma.annualBudget.findMany({
      where: {
        parent_budget_id: null, // Hanya ambil Parent (Tahunan)
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

    // 4. Optimasi: Kumpulkan semua Meter ID yang terlibat di tahun ini
    // Agar kita bisa query ke dailySummary sekali jalan (Batching)
    const allMeterIds = new Set<number>();
    parentBudgets.forEach((budget) => {
      budget.child_budgets.forEach((child) => {
        child.allocations.forEach((alloc) => {
          if (alloc.meter_id) allMeterIds.add(alloc.meter_id);
        });
      });
    });

    // 5. Ambil Data Realisasi (Daily Summary)
    // Group by meter_id agar mudah dipetakan
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

    // Helper Map: MeterID -> TotalCost (untuk akses O(1))
    const meterCostMap = new Map<number, number>();
    rawRealisations.forEach((r) => {
      meterCostMap.set(r.meter_id, r._sum.total_cost?.toNumber() || 0);
    });

    // 6. Mapping Hasil Akhir
    const results = parentBudgets.map((budget) => {
      const totalBudget = budget.total_budget.toNumber();

      // Hitung Realisasi Spesifik untuk Budget ini
      // Caranya: Ambil semua meter ID milik budget ini, lalu jumlahkan cost-nya dari Map
      let totalRealization = 0;

      // Kumpulkan meter ID unik milik budget ini
      const budgetMeterIds = new Set<number>();
      budget.child_budgets.forEach((child) => {
        child.allocations.forEach((alloc) => {
          if (alloc.meter_id) budgetMeterIds.add(alloc.meter_id);
        });
      });

      // Sum cost dari Map
      budgetMeterIds.forEach((meterId) => {
        totalRealization += meterCostMap.get(meterId) || 0;
      });

      // Hitung Sisa & Persentase
      const remainingBudget = totalBudget - totalRealization;

      // Hindari pembagian dengan nol
      const realizationPercentage =
        totalBudget > 0 ? (totalRealization / totalBudget) * 100 : 0;

      // Tentukan Status untuk UI (Warna)
      let status: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';
      if (realizationPercentage >= 100) status = 'DANGER';
      else if (realizationPercentage >= 80) status = 'WARNING';

      // Return Format sesuai kebutuhan UI (BudgetSummaryItem)
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

  /**
   * BARU: Menyiapkan data untuk pembuatan anggaran periode berikutnya.
   * Fungsi ini akan menghitung sisa anggaran dari periode induk.
   * @param parentBudgetId - ID dari anggaran induk (tahunan).
   */
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
        throw new Error400(
          'Anggaran yang diberikan bukan merupakan anggaran induk (tahunan).'
        );
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
            realizationResult._sum.total_cost ?? new Prisma.Decimal(0)
          );
        }
      }

      const availableBudgetForNextPeriod =
        parentBudget.total_budget.minus(totalRealizationCost);

      return {
        parentBudgetId: parentBudget.budget_id,
        parentTotalBudget: parentBudget.total_budget.toNumber(),
        totalRealizationCost: totalRealizationCost.toNumber(),
        availableBudgetForNextPeriod: availableBudgetForNextPeriod.toNumber(),
      };
    });
  }

  /**
   * BARU: Menjalankan klasifikasi untuk satu meter pada tanggal tertentu.
   * @param date - Tanggal data yang akan diklasifikasi.
   * @param meterId - ID meter yang akan diklasifikasi.
   */
  public async runSingleClassification(
    date: Date,
    meterId: number
  ): Promise<void> {
    return this._handleCrudOperation(async () => {
      const summary = await prisma.dailySummary.findFirst({
        where: {
          meter_id: meterId,
          summary_date: date,
        },
        include: {
          meter: {
            include: {
              energy_type: true,
              category: true,
              tariff_group: {
                include: {
                  price_schemes: { include: { rates: true, taxes: true } },
                },
              },
            },
          },
        },
      });

      if (!summary) {
        throw new Error404(
          `Tidak ada data ringkasan (DailySummary) yang ditemukan untuk meter ID ${meterId} pada tanggal ${date.toISOString().split('T')[0]}.`
        );
      }

      await _classifyDailyUsage(summary, summary.meter);
    });
  }

  /**
   * BARU: Menghitung pratinjau target efisiensi berdasarkan anggaran.
   * @param data - Berisi totalBudget, meterId, dan periode.
   */
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
        throw new Error400(
          'Periode tidak valid, tanggal akhir harus setelah tanggal mulai.'
        );
      }

      const meter = await this._prisma.meter.findUnique({
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
          `Tidak ada skema harga aktif yang ditemukan untuk golongan tarif meter '${meter.meter_code}'.`
        );
      }

      let avgPricePerUnit: Prisma.Decimal;
      if (meter.energy_type.type_name === 'Electricity') {
        const wbpRate = activePriceScheme.rates.find(
          (r: any) => r.reading_type.type_name === 'WBP'
        )?.value;
        const lwbpRate = activePriceScheme.rates.find(
          (r: any) => r.reading_type.type_name === 'LWBP'
        )?.value;

        if (!wbpRate || !lwbpRate) {
          throw new Error400(
            'Skema harga untuk Listrik tidak lengkap. Tarif WBP atau LWBP tidak ditemukan.'
          );
        }

        avgPricePerUnit = wbpRate.plus(lwbpRate).div(2);
      } else {
        const singleRate = activePriceScheme.rates[0]?.value;
        if (!singleRate) {
          throw new Error400(
            `Skema harga untuk ${meter.energy_type.type_name} tidak memiliki tarif yang terdefinisi.`
          );
        }
        avgPricePerUnit = singleRate;
      }

      if (avgPricePerUnit.isZero()) {
        throw new Error400(
          'Harga rata-rata per unit adalah nol. Tidak dapat menghitung target dari anggaran.'
        );
      }

      const inputTotalKwh = new Prisma.Decimal(target_value).times(totalDays);
      const estimatedTotalCost = inputTotalKwh.times(avgPricePerUnit);

      const budgetAllocation = await this._prisma.budgetAllocation.findFirst({
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
        const allocatedBudgetForMeter =
          budgetAllocation.budget.total_budget.times(budgetAllocation.weight);

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
          const realizationResult = await this._prisma.dailySummary.aggregate({
            _sum: { total_cost: true },
            where: {
              meter_id: meterId,
              summary_date: {
                gte: budgetAllocation.budget.period_start,
                lte: realizationEndDate,
              },
            },
          });

          realizedCost =
            realizationResult._sum.total_cost ?? new Prisma.Decimal(0);
          remainingBudget = allocatedBudgetForMeter.minus(realizedCost);

          (budgetInfo as any).realizationToDate = realizedCost.toNumber();
          (budgetInfo as any).remainingBudget = remainingBudget.toNumber();
        }

        const childBudget = budgetAllocation.budget;
        const childPeriodDays =
          differenceInDays(childBudget.period_end, childBudget.period_start) +
          1;
        const childPeriodMonths =
          (childBudget.period_end.getUTCFullYear() -
            childBudget.period_start.getUTCFullYear()) *
            12 +
          (childBudget.period_end.getUTCMonth() -
            childBudget.period_start.getUTCMonth()) +
          1;

        const dailyBudgetForMeter =
          allocatedBudgetForMeter.div(childPeriodDays);

        const suggestedDailyKwh = dailyBudgetForMeter.div(avgPricePerUnit);

        suggestion = {
          standard: {
            message: `Berdasarkan alokasi anggaran periode ini, target harian Anda adalah sekitar ${suggestedDailyKwh.toDP(2)} ${meter.energy_type.unit_of_measurement}.`,
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
