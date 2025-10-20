import prisma from '../configs/db.js';
import { Prisma, UsageCategory } from '../generated/prisma/index.js';
import { machineLearningService } from './machineLearning.service.js';
import type {
  BulkPredictionBody,
  GetAnalysisQuery,
  DailyAnalysisRecord,
} from '../types/analysis.types.js';
import { Error400, Error404 } from '../utils/customError.js';
import { BaseService } from '../utils/baseService.js';
import { weatherService } from './weather.service.js';
import { differenceInDays } from 'date-fns';

// BARU: Tipe untuk hasil ringkasan klasifikasi
export type ClassificationSummary = {
  [key in UsageCategory]?: number;
} & {
  totalDaysInMonth: number;
  totalDaysWithData: number;
  totalDaysWithClassification: number;
};

// BARU: Tipe untuk ringkasan klasifikasi listrik yang dipisah
type ElectricityClassificationSummary = {
  terminal: ClassificationSummary;
  kantor: ClassificationSummary;
};

// BARU: Tipe untuk alokasi anggaran bulanan
type MonthlyBudgetAllocation = {
  month: number;
  monthName: string;
  allocatedBudget: number;
  realizationCost: number;
  remainingBudget: number;
  realizationPercentage: number | null;
};

// BARU: Tipe untuk ringkasan anggaran per jenis energi
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
  } | null; // Bisa null jika tidak ada anggaran aktif
};

type MeterAnalysisData = {
  meterId: number;
  meterName: string;
  data: DailyAnalysisRecord[];
};

// BARU: Tipe data untuk analisis sisa stok BBM
// PERBAIKAN: Tipe diubah menjadi ringkasan, bukan data harian
type FuelStockSummaryRecord = {
  meterId: number;
  meterName: string;
  remaining_stock: number | null;
  percentage: number | null;
  tank_volume: number | null;
  last_reading_date: Date | null;
};

// BARU: Tipe data untuk respons getTodaySummary
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
export class AnalysisService extends BaseService {
  constructor() {
    super(prisma);
  }

  public async getMonthlyAnalysis(
    query: GetAnalysisQuery
  ): Promise<MeterAnalysisData[]> {
    const { energyType, month: monthString, meterId } = query;

    // PERBAIKAN: Logika penentuan rentang tanggal yang lebih andal.
    const [year, month] = monthString.split('-').map(Number);
    const monthIndex = month - 1; // Konversi bulan (1-12) ke index (0-11)

    // Tanggal mulai adalah hari pertama bulan yang diminta, pada UTC.
    const startDate = new Date(Date.UTC(year, monthIndex, 1));
    // Tanggal akhir adalah hari terakhir bulan yang diminta, pada UTC.
    const endDate = new Date(
      Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999) // Hari ke-0 bulan berikutnya adalah hari terakhir bulan ini.
    );

    // Cari ID untuk energyType yang diminta
    const energyTypeRecord = await prisma.energyType.findUnique({
      where: { type_name: energyType },
    });
    if (!energyTypeRecord) {
      throw new Error(`Tipe energi '${energyType}' tidak ditemukan.`);
    }

    // LANGKAH 2: AMBIL SEMUA DATA RELEVAN DENGAN INFORMASI METER
    // Buat klausa 'where' yang dinamis
    const whereClause: Prisma.DailySummaryWhereInput = {
      meter: {
        energy_type_id: energyTypeRecord.energy_type_id,
        ...(meterId && { meter_id: meterId }),
      },
      summary_date: { gte: startDate, lte: endDate },
    };

    // PERBAIKAN: Ambil semua data relevan dalam satu query yang lebih efisien.
    // Ini mengurangi jumlah panggilan ke database.
    const summaries = await prisma.dailySummary.findMany({
      where: whereClause,
      include: {
        meter: true, // Sertakan data meter untuk mendapatkan nama dan ID
        classification: true, // BARU: Sertakan data klasifikasi
      },
    });

    // Ambil semua target yang relevan untuk meter yang ditemukan
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

    // Buat peta untuk akses cepat target per meter
    // PERBAIKAN: Simpan target konsumsi (value) dan target biaya (cost)
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

    // LANGKAH 3: PROSES DAN KELOMPOKKAN DATA PER METER ID
    const dataByMeter = new Map<
      number,
      {
        meterName: string;
        dailyData: Map<string, Partial<DailyAnalysisRecord>>; // Gunakan Partial karena data diisi bertahap
      }
    >();

    // Proses data konsumsi aktual
    for (const summary of summaries) {
      const meterId = summary.meter_id;
      const meterName = summary.meter.meter_code;
      const dateString = summary.summary_date.toISOString().split('T')[0];

      if (!dataByMeter.has(meterId)) {
        dataByMeter.set(meterId, { meterName, dailyData: new Map() });
      }

      // PERBAIKAN: Gunakan `total_consumption` dari DailySummary yang sudah akurat.
      const totalConsumption = summary.total_consumption?.toNumber() ?? null;

      const dayData = dataByMeter.get(meterId)!.dailyData.get(dateString) || {};
      dayData.actual_consumption = totalConsumption;
      // BARU: Tambahkan data klasifikasi ke data harian
      dayData.consumption_cost = summary.total_cost?.toNumber() ?? null;
      dayData.classification = summary.classification?.classification ?? null;
      dayData.confidence_score =
        summary.classification?.confidence_score ?? null;
      dataByMeter.get(meterId)!.dailyData.set(dateString, dayData);
    }

    // Proses data prediksi
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

    // LANGKAH 4: BANGUN SERI WAKTU LENGKAP UNTUK SETIAP METER
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
          classification: dayData?.classification ?? null, // BARU: Kirim data klasifikasi
          confidence_score: dayData?.confidence_score ?? null, // BARU: Kirim confidence_score
          efficiency_target: targetsByMeter.get(meterId)?.value ?? null,
          efficiency_target_cost: targetsByMeter.get(meterId)?.cost ?? null, // BARU: Kirim target biaya
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

    // 1. Tentukan tanggal akhir periode analisis
    const [year, month] = monthString.split('-').map(Number);
    const monthIndex = month - 1;
    const endDate = new Date(
      Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)
    );

    // 2. Ambil semua meter BBM yang aktif beserta volume tangkinya
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

    // 3. Untuk setiap meter, cari pembacaan stok terakhirnya hingga tanggal akhir bulan
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

    // 4. Jalankan semua promise secara paralel dan kembalikan hasilnya
    return Promise.all(summaryPromises);
  }

  /**
   * BARU: Menghitung ringkasan jumlah klasifikasi (BOROS, HEMAT, NORMAL)
   * untuk periode dan filter yang diberikan.
   */
  public async getClassificationSummary(
    // PERBAIKAN: Fungsi ini sekarang spesifik untuk listrik dan tidak memerlukan filter generik.
    query: Omit<GetAnalysisQuery, 'energyType' | 'meterId'>
  ): Promise<ElectricityClassificationSummary> {
    const { month } = query;
    // 1. Tentukan rentang tanggal dari parameter 'month'
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

    // 2. Ambil ID meter untuk Terminal dan Kantor
    const [terminalMeter, kantorMeter] = await Promise.all([
      prisma.meter.findUnique({ where: { meter_code: 'ELEC-TERM-01' } }),
      prisma.meter.findUnique({ where: { meter_code: 'ELEC-KANTOR-01' } }),
    ]);

    if (!terminalMeter || !kantorMeter) {
      throw new Error404(
        'Meteran listrik untuk Terminal atau Kantor tidak ditemukan. Pastikan meter dengan kode ELEC-TERM-01 dan ELEC-KANTOR-01 ada.'
      );
    }

    // 3. Hitung ringkasan untuk masing-masing meter secara paralel
    const [terminalSummary, kantorSummary] = await Promise.all([
      this._getSummaryForMeter(terminalMeter.meter_id, startDate, endDate),
      this._getSummaryForMeter(kantorMeter.meter_id, startDate, endDate),
    ]);

    // 4. Gabungkan hasil
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
    // PERBAIKAN: Logika penentuan tanggal "hari ini" yang lebih andal dan anti-bug timezone.
    // 1. Buat string tanggal (YYYY-MM-DD) langsung dari zona waktu yang diinginkan.
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

    // 2. Buat objek Date baru dari string tersebut. Ini akan menghasilkan tanggal
    // pada tengah malam UTC, yang konsisten dengan cara data disimpan di database.
    // Contoh: '2025-10-12' -> 2025-10-12T00:00:00.000Z
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

    // PERBAIKAN: Ambil data summary dan data pax secara paralel.
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

    // PERBAIKAN: Kembalikan data dengan struktur baru { meta, data }.
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
  public async runBulkPredictions(body: BulkPredictionBody): Promise<void> {
    const { startDate, endDate, userId } = body;
    const jobDescription = `bulk-predict-${userId}-${Date.now()}`;

    console.log(
      `[BACKGROUND JOB - ${jobDescription}] Memulai prediksi massal dari ${startDate.toISOString()} hingga ${endDate.toISOString()}`
    );

    // Fungsi helper untuk mengirim notifikasi ke pengguna yang meminta
    const notifyUser = (event: string, data: unknown) => {
      if (userId) {
        prisma.user.findUnique({ where: { user_id: userId } }).then((user) => {
          if (user) {
            // Implementasi socket.io Anda akan digunakan di sini
            // socketServer.io.to(String(userId)).emit(event, data);
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

        // Panggil logika prediksi yang ada di predictionRunner
        // (Logika ini perlu diekstrak ke fungsi yang bisa digunakan bersama)
        // Untuk saat ini, kita replikasi logikanya di sini.
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
    // PERBAIKAN: Ambil meter dari DB untuk mendapatkan ID yang benar
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

    // PERBAIKAN: Jika targetMeterId diberikan, pastikan itu adalah salah satu dari dua meter ini.
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
    const modelVersion = 'pax-integrated-v3.1'; // Sesuaikan versi model

    const predictionDate = new Date(baseDate);
    // PERBAIKAN: Prediksi dijalankan untuk H+1 dari baseDate
    const predictionDateStr = baseDate.toISOString().split('T')[0];

    try {
      // PERBAIKAN: Panggil weatherService untuk memastikan data cuaca ada.
      // Jika gagal (misal: API down), gunakan nilai default agar prediksi tetap berjalan.
      const weatherDataFromService =
        await weatherService.getForecast(predictionDate);
      const weatherData = {
        suhu_rata: weatherDataFromService?.suhu_rata ?? 28.0,
        suhu_max: weatherDataFromService?.suhu_max ?? 32.0,
      };

      console.log(
        `[Prediction]  Menjalankan prediksi untuk ${predictionDateStr}...`
      );

      const predictionsToRun = [];

      // Tentukan prediksi mana yang akan dijalankan
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
    // PERBAIKAN: Kirim data cuaca yang sudah disiapkan
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
    // PERBAIKAN: Kirim data cuaca yang sudah disiapkan
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
    // 1. Tentukan periode satu tahun penuh
    const yearStartDate = new Date(Date.UTC(year, 0, 1));
    const yearEndDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    // 2. Ambil semua periode anggaran yang tumpang tindih dengan tahun yang diminta
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

    // 3. Inisialisasi hasil untuk 12 bulan
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

    // 4. Hitung dan distribusikan alokasi anggaran ke setiap bulan
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

        // Tentukan tanggal mulai dan akhir irisan antara bulan dan periode anggaran
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

    // 5. Ambil data realisasi biaya dari DailySummary, dikelompokkan per bulan
    const realizationResult = await prisma.$queryRaw<
      { month: number; total_cost: number }[]
    >(
      // PERBAIKAN: Ambil realisasi hanya untuk tipe energi yang anggarannya ada.
      // Ini mencegah biaya BBM atau Air tercampur dengan anggaran Listrik.
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

    // 6. Gabungkan data realisasi ke dalam hasil akhir
    for (const realization of realizationResult) {
      const monthIndex = realization.month - 1;
      if (monthlyAllocations[monthIndex]) {
        monthlyAllocations[monthIndex].realizationCost = Number(
          realization.total_cost
        );
      }
    }

    // 7. Hitung sisa dan persentase
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
    // PERBAIKAN: Input sekarang adalah ID anggaran induk (tahunan)
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
      suggestedBudgetForPeriod: number; // BARU: Tambahkan saran
    };
  }> {
    const { parent_budget_id, period_start, period_end, allocations } =
      budgetData;

    // 1. Ambil data anggaran induk (tahunan)
    const parentBudget = await this._prisma.annualBudget.findUnique({
      where: { budget_id: parent_budget_id },
      include: {
        // PERBAIKAN: Ambil alokasi dari SEMUA anak untuk menghitung realisasi.
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

    // 2. Hitung anggaran efisiensi (misal: 95% dari total)
    const efficiencyTag = parentBudget.efficiency_tag ?? new Prisma.Decimal(1);
    const efficiencyBudget = parentBudget.total_budget.times(efficiencyTag);

    // 3. Hitung realisasi biaya hingga H-1 dari periode pratinjau
    const realizationEndDate = new Date(period_start);
    realizationEndDate.setUTCDate(realizationEndDate.getUTCDate() - 1);

    // --- DEBUGGING LOGS ---
    console.log('--- DEBUG: Menghitung Realisasi Anggaran ---');
    console.log('Periode Anggaran Induk:', {
      start: parentBudget.period_start.toISOString(),
      end: parentBudget.period_end.toISOString(),
    });
    console.log(
      'Periode Realisasi Dihitung Hingga:',
      realizationEndDate.toISOString()
    );

    // PERBAIKAN: Hitung realisasi dengan menjumlahkan realisasi dari setiap anggaran anak
    // sesuai dengan periode masing-masing anak.
    let realizationToDate = new Prisma.Decimal(0);

    // PERBAIKAN: Berikan tipe eksplisit untuk 'child' untuk membantu transpiler.
    for (const child of parentBudget.child_budgets as Prisma.AnnualBudgetGetPayload<{
      include: { allocations: { select: { meter_id: true } } };
    }>[]) {
      const childMeterIds = child.allocations.map((a) => a.meter_id);
      if (childMeterIds.length > 0) {
        // Pastikan rentang tanggal realisasi tidak melebihi periode anak atau tanggal akhir global
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

    // 4. Hitung sisa anggaran yang tersedia untuk periode baru
    const remainingBudgetForPeriod = efficiencyBudget.minus(realizationToDate);

    // --- BARU: Hitung Saran Anggaran untuk Periode ---
    let suggestedBudgetForPeriod: Prisma.Decimal;

    // 5. Hitung panjang periode dalam bulan
    const periodMonths =
      (period_end.getUTCFullYear() - period_start.getUTCFullYear()) * 12 +
      (period_end.getUTCMonth() - period_start.getUTCMonth()) +
      1;

    console.log('Panjang Periode (bulan):', periodMonths);

    if (periodMonths <= 0) {
      throw new Error400('Periode tidak valid.');
    }

    // 6. Hitung alokasi anggaran per bulan untuk periode baru
    let budgetPerMonth: Prisma.Decimal;
    if (parentBudget.child_budgets.length === 0) {
      // Skenario 1: Belum ada anggaran periode sebelumnya.
      // Gunakan rata-rata dari anggaran tahunan.
      budgetPerMonth = parentBudget.total_budget.div(12);
    } else {
      // Skenario 2: Sudah ada anggaran periode sebelumnya.
      // Gunakan sisa anggaran dibagi panjang periode baru.
      budgetPerMonth = remainingBudgetForPeriod.div(periodMonths);
    }

    // --- PERBAIKAN: Hitung Saran Anggaran untuk Periode ---
    if (realizationToDate.isZero()) {
      // Skenario 1: Belum ada realisasi. Gunakan budgetPerMonth dikali panjang periode.
      // Di sini, budgetPerMonth adalah (total_budget / 12). Saran adalah total anggaran efisiensi.
      suggestedBudgetForPeriod = efficiencyBudget;
    } else {
      // Skenario 2: Sudah ada realisasi. Gunakan sisa anggaran efisiensi.
      suggestedBudgetForPeriod = remainingBudgetForPeriod;
    }

    // 7. Buat pratinjau alokasi bulanan
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

    // 8. Kalkulasi Pratinjau Alokasi per Meter
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
          meterName: `Meter ${alloc.meter_id}`, // Placeholder, bisa diambil dari DB jika perlu
          allocatedBudget: allocatedBudget.toNumber(),
          dailyBudgetAllocation: dailyBudgetAllocation.toNumber(),
          estimatedDailyKwh: 0, // Placeholder, logika estimasi kWh bisa ditambahkan di sini
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
  public async getBudgetSummary(): Promise<BudgetSummaryByEnergy[]> {
    // PERBAIKAN: Mengoptimalkan query untuk menghindari N+1 problem.
    // Semua data diambil dalam beberapa query besar, lalu diproses di memory.
    const today = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate()
      )
    );
    const currentYear = today.getUTCFullYear();
    const yearStartDate = new Date(Date.UTC(currentYear, 0, 1));
    const yearEndDate = new Date(
      Date.UTC(currentYear, 11, 31, 23, 59, 59, 999)
    );

    // 1. Ambil semua data yang relevan dalam beberapa query besar
    const [energyTypes, allBudgetsInYear, allRealisations] = await Promise.all([
      prisma.energyType.findMany({ where: { is_active: true } }),
      prisma.annualBudget.findMany({
        where: {
          parent_budget_id: null,
          OR: [
            {
              period_start: { lte: yearEndDate },
              period_end: { gte: yearStartDate },
            },
          ],
        },
      }),
      prisma.dailySummary.groupBy({
        by: ['meter_id'],
        _sum: { total_cost: true },
        where: { summary_date: { gte: yearStartDate, lt: today } },
      }),
    ]);

    // 2. Proses dan kelompokkan data di memory untuk akses cepat
    const meters = await prisma.meter.findMany({
      select: { meter_id: true, energy_type_id: true },
    });
    const meterToEnergyMap = new Map(
      meters.map((m) => [m.meter_id, m.energy_type_id])
    );

    const realisationsByEnergyType = new Map<number, Prisma.Decimal>();
    for (const real of allRealisations) {
      const energyTypeId = meterToEnergyMap.get(real.meter_id);
      if (energyTypeId) {
        const currentSum =
          realisationsByEnergyType.get(energyTypeId) ?? new Prisma.Decimal(0);
        const newSum = currentSum.plus(real._sum.total_cost ?? 0);
        realisationsByEnergyType.set(energyTypeId, newSum);
      }
    }

    // 3. Bangun hasil akhir dengan iterasi melalui energyTypes
    const results: BudgetSummaryByEnergy[] = energyTypes.map((energyType) => {
      const budgetsForThisEnergy = allBudgetsInYear.filter(
        (b) => b.energy_type_id === energyType.energy_type_id
      );

      const budgetThisYear = budgetsForThisEnergy.reduce(
        (sum, budget) => sum.plus(budget.total_budget),
        new Prisma.Decimal(0)
      );

      const activeBudget = budgetsForThisEnergy.find(
        (b) => b.period_start <= today && b.period_end >= today
      );

      let currentPeriodSummary: BudgetSummaryByEnergy['currentPeriod'] = null;
      if (activeBudget) {
        // Ambil total realisasi yang sudah dikelompokkan
        const totalRealization =
          realisationsByEnergyType.get(energyType.energy_type_id) ??
          new Prisma.Decimal(0);

        const remainingBudget =
          activeBudget.total_budget.minus(totalRealization);
        const realizationPercentage =
          activeBudget.total_budget.isZero() ||
          activeBudget.total_budget.isNegative()
            ? null
            : parseFloat(
                totalRealization
                  .div(activeBudget.total_budget)
                  .times(100)
                  .toFixed(2)
              );

        currentPeriodSummary = {
          budgetId: activeBudget.budget_id,
          periodStart: activeBudget.period_start,
          periodEnd: activeBudget.period_end,
          totalBudget: activeBudget.total_budget.toNumber(),
          totalRealization: totalRealization.toNumber(),
          remainingBudget: remainingBudget.toNumber(),
          realizationPercentage,
        };
      }

      return {
        energyTypeId: energyType.energy_type_id,
        energyTypeName: energyType.type_name,
        budgetThisYear: budgetThisYear.toNumber(),
        currentPeriod: currentPeriodSummary,
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
      // LANGKAH 1: Ambil data anggaran induk dan semua anak-anaknya beserta alokasinya.
      const parentBudget = await prisma.annualBudget.findUniqueOrThrow({
        where: { budget_id: parentBudgetId },
        include: {
          // PERBAIKAN: Ambil alokasi dari setiap anak untuk menghitung realisasi.
          child_budgets: {
            include: {
              allocations: {
                select: { meter_id: true },
              },
            },
          },
        },
      });

      // Pastikan ini adalah anggaran induk.
      if (parentBudget.parent_budget_id !== null) {
        throw new Error400(
          'Anggaran yang diberikan bukan merupakan anggaran induk (tahunan).'
        );
      }

      // LANGKAH 2: Hitung total realisasi biaya dengan menjumlahkan realisasi dari setiap anggaran anak.
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
              // PERBAIKAN: Gunakan periode dari anggaran anak, bukan induk.
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

      // LANGKAH 3: Hitung sisa anggaran yang tersedia dari pagu tahunan setelah dikurangi realisasi.
      const availableBudgetForNextPeriod =
        parentBudget.total_budget.minus(totalRealizationCost);

      // LANGKAH 4: Kembalikan hasilnya.
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
      // 1. Ambil DailySummary untuk meter dan tanggal yang diberikan.
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

      // 2. Panggil logika klasifikasi yang sudah ada di ReadingService.
      // Impor dinamis untuk menghindari dependensi sirkular.
      const { ReadingService } = await import('./reading.service.js');
      const readingService = new ReadingService();
      // @ts-ignore - Memanggil metode privat untuk tujuan ini.
      await readingService._classifyDailyUsage(summary, summary.meter);
    });
  }

  /**
   * BARU: Menghitung pratinjau target efisiensi berdasarkan anggaran.
   * @param data - Berisi totalBudget, meterId, dan periode.
   */
  public async getEfficiencyTargetPreview(data: {
    target_value: number; // PERBAIKAN: Menggunakan snake_case dari FE
    meterId: number;
    periodStartDate: Date;
    periodEndDate: Date;
  }) {
    return this._handleCrudOperation(async () => {
      const { target_value, meterId, periodStartDate, periodEndDate } = data;

      // 1. Validasi periode
      if (periodEndDate < periodStartDate) {
        throw new Error400('Tanggal akhir tidak boleh sebelum tanggal mulai.');
      }
      const totalDays = differenceInDays(periodEndDate, periodStartDate) + 1;
      if (totalDays <= 0) {
        throw new Error400(
          'Periode tidak valid, tanggal akhir harus setelah tanggal mulai.'
        );
      }

      // 2. Ambil data meter dan skema harganya
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

      // 3. Hitung harga rata-rata per unit
      let avgPricePerUnit: Prisma.Decimal;
      if (meter.energy_type.type_name === 'Electricity') {
        const wbpRate = activePriceScheme.rates.find(
          (r) => r.reading_type.type_name === 'WBP'
        )?.value;
        const lwbpRate = activePriceScheme.rates.find(
          (r) => r.reading_type.type_name === 'LWBP'
        )?.value;

        if (!wbpRate || !lwbpRate) {
          throw new Error400(
            'Skema harga untuk Listrik tidak lengkap. Tarif WBP atau LWBP tidak ditemukan.'
          );
        }
        // Menggunakan harga rata-rata untuk estimasi
        avgPricePerUnit = wbpRate.plus(lwbpRate).div(2);
      } else {
        // Untuk Air atau BBM, ambil tarif pertama yang ada
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

      // 4. Hitung estimasi biaya berdasarkan input targetKwh
      const inputTotalKwh = new Prisma.Decimal(target_value).times(totalDays);
      const estimatedTotalCost = inputTotalKwh.times(avgPricePerUnit);

      // 5. Cari alokasi anggaran yang relevan untuk meter dan periode ini
      const budgetAllocation = await this._prisma.budgetAllocation.findFirst({
        where: {
          meter_id: meterId,
          budget: {
            parent_budget_id: { not: null }, // Pastikan ini adalah anggaran periode (anak)
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
          // PERBAIKAN: Tambahkan informasi realisasi
          realizationToDate: 0, // Default value
          remainingBudget: allocatedBudgetForMeter.toNumber(), // Default value
        };

        // PERBAIKAN: Hitung realisasi hingga H-1 dari tanggal mulai target
        const realizationEndDate = new Date(periodStartDate);
        realizationEndDate.setUTCDate(realizationEndDate.getUTCDate() - 1);

        let remainingBudget = allocatedBudgetForMeter;
        let realizedCost = new Prisma.Decimal(0); // PERBAIKAN: Deklarasikan di luar blok if

        // Hanya hitung realisasi jika periode target dimulai setelah periode anggaran
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
            realizationResult._sum.total_cost ?? new Prisma.Decimal(0); // PERBAIKAN: Assign nilai, jangan deklarasi ulang
          remainingBudget = allocatedBudgetForMeter.minus(realizedCost);

          // Update budgetInfo dengan data realisasi
          (budgetInfo as any).realizationToDate = realizedCost.toNumber();
          (budgetInfo as any).remainingBudget = remainingBudget.toNumber();
        }

        // --- PERBAIKAN: Logika baru untuk menghitung saran berdasarkan anggaran harian ---
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

        // Hitung anggaran harian berdasarkan alokasi untuk meter ini
        const dailyBudgetForMeter =
          allocatedBudgetForMeter.div(childPeriodDays);

        // Konversi anggaran harian (Rp) ke kWh
        const suggestedDailyKwh = dailyBudgetForMeter.div(avgPricePerUnit);

        suggestion = {
          standard: {
            message: `Berdasarkan alokasi anggaran periode ini, target harian Anda adalah sekitar ${suggestedDailyKwh.toDP(2)} ${meter.energy_type.unit_of_measurement}.`,
            suggestedDailyKwh: suggestedDailyKwh.toNumber(),
            suggestedTotalKwh: suggestedDailyKwh.times(totalDays).toNumber(),
          },
        };
      }

      // 6. Kembalikan hasil pratinjau dan saran
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
