import prisma from '../../configs/db.js';
import type { DailySummary, Prisma } from '../../generated/prisma/index.js';
import type { DefaultArgs } from '../../generated/prisma/runtime/library.js';
import type {
  CreateSummaryBody,
  GetSummaryQuery,
  UpdateSummaryBody,
} from '../../types/dailySummary.type.js';
import type { CustomErrorMessages } from '../../utils/baseService.js';

import { GenericBaseService } from '../../utils/GenericBaseService.js';
import { weatherService } from '../weather.service.js';

// PERBAIKAN: Definisi tipe yang lebih jelas dan konsisten untuk laporan perbandingan.
type ComparisonValue = {
  currentValue: number;
  previousValue: number;
  percentageChange: number | null;
};

type EnergySummary = {
  energyType: string;
  unit: string;
  totalConsumption: ComparisonValue;
  totalCost: ComparisonValue;
};

type MonthlyComparisonReport = {
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
    avg_temp: number | null;
    max_temp: number | null;
  } | null;
};

type MonthlyData = {
  totalPax: number;
  avgTemp: number;
  avgMaxTemp: number;
  todayTemp: { avg_temp: number | null; max_temp: number | null } | null;
  summary: {
    energyType: string;
    unit: string;
    totalConsumption: number;
    totalCost: number;
  }[];
};

type DailySummaryQuery = Prisma.DailySummaryFindManyArgs & GetSummaryQuery;
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
    // Ambil semua kemungkinan filter dari query
    const { month, meterId } = query; // Contoh: tambahkan meterId

    // PERBAIKAN: Buat klausa 'where' sebagai objek terpisah
    const where: Prisma.DailySummaryWhereInput = {};

    // Bangun 'where' secara dinamis
    if (month) {
      const year = parseInt(month.split('-')[0]);
      const monthIndex = parseInt(month.split('-')[1]) - 1;
      const startDate = new Date(Date.UTC(year, monthIndex, 1));
      const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));

      // Tambahkan kondisi tanggal ke 'where'
      where.summary_date = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (meterId) {
      // Tambahkan kondisi meterId ke 'where'
      where.meter_id = meterId;
    }

    // Gabungkan 'where' yang sudah jadi dengan argumen lainnya
    const findArgs: Prisma.DailySummaryFindManyArgs = {
      where, // Gunakan objek 'where' yang sudah dibangun
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
    month: number
  ): Promise<MonthlyComparisonReport> {
    // Jalankan semua logika di dalam error handler
    const buildReport = async (): Promise<MonthlyComparisonReport> => {
      // LANGKAH 2: TENTUKAN PERIODE BULAN INI DAN BULAN SEBELUMNYA
      const currentStartDate = new Date(Date.UTC(year, month - 1, 1));
      const currentEndDate = new Date(
        Date.UTC(year, month, 0, 23, 59, 59, 999)
      );

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

      // LANGKAH 3: AMBIL DATA KEDUA PERIODE SECARA PARALEL
      const [currentData, previousData] = await Promise.all([
        this._getMonthlyData(currentStartDate, currentEndDate),
        this._getMonthlyData(prevStartDate, prevEndDate),
      ]);

      // LANGKAH 4: BANDINGKAN DATA
      // PERBAIKAN: Logika diubah untuk memastikan perbandingan tetap ada meskipun data bulan ini kosong.
      // 1. Buat Map dari data bulan ini dan bulan lalu untuk pencarian cepat.
      const currentSummaryMap = new Map(
        currentData.summary.map((s) => [s.energyType, s])
      );
      const previousSummaryMap = new Map(
        previousData.summary.map((s) => [s.energyType, s])
      );

      // 2. Dapatkan semua tipe energi unik dari kedua periode.
      const allEnergyTypes = new Set([
        ...currentSummaryMap.keys(),
        ...previousSummaryMap.keys(),
      ]);

      // 3. Iterasi melalui semua tipe energi untuk membangun ringkasan perbandingan.
      const summary: EnergySummary[] = Array.from(allEnergyTypes).map(
        (energyType) => {
          const currentSummary = currentSummaryMap.get(energyType);
          const previousSummary = previousSummaryMap.get(energyType);

          const currentValue = currentSummary?.totalConsumption ?? 0;
          const previousValue = previousSummary?.totalConsumption ?? 0;
          const currentCost = currentSummary?.totalCost ?? 0;
          const previousCost = previousSummary?.totalCost ?? 0;

          return {
            energyType: energyType,
            unit: currentSummary?.unit || previousSummary?.unit || '',
            totalConsumption: {
              currentValue: currentValue,
              previousValue: previousValue,
              percentageChange: this._calculatePercentageChange(
                currentValue,
                previousValue
              ),
            },
            totalCost: {
              currentValue: currentCost,
              previousValue: previousCost,
              percentageChange: this._calculatePercentageChange(
                currentCost,
                previousCost
              ),
            },
          };
        }
      );

      // LANGKAH 5: BANGUN LAPORAN AKHIR
      const finalReport: MonthlyComparisonReport = {
        reportPeriod: {
          year,
          month,
          monthName: new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(
            currentStartDate
          ),
          startDate: currentStartDate.toISOString(),
          endDate: currentEndDate.toISOString(),
        },
        totalPax: {
          currentValue: currentData.totalPax,
          previousValue: previousData.totalPax,
          percentageChange: this._calculatePercentageChange(
            currentData.totalPax,
            previousData.totalPax
          ),
        },
        // BARU: Tambahkan data perbandingan suhu rata-rata
        averageTemperature: {
          currentValue: currentData.avgTemp,
          previousValue: previousData.avgTemp,
          percentageChange: this._calculatePercentageChange(
            currentData.avgTemp,
            previousData.avgTemp
          ),
        },
        // BARU: Tambahkan data perbandingan suhu maksimal rata-rata
        averageMaxTemperature: {
          currentValue: currentData.avgMaxTemp,
          previousValue: previousData.avgMaxTemp,
          percentageChange: this._calculatePercentageChange(
            currentData.avgMaxTemp,
            previousData.avgMaxTemp
          ),
        },
        // Tambahkan data suhu hari ini ke laporan akhir
        todayTemperature: currentData.todayTemp,
        summary,
      };

      return finalReport;
    };

    return this._handleCrudOperation(buildReport);
  }

  private async _getMonthlyData(
    startDate: Date,
    endDate: Date
  ): Promise<MonthlyData> {
    let todayWeather: { suhu_rata: number; suhu_max: number } | null = null; // Tipe disesuaikan dengan return WeatherService
    const today = new Date();

    // Jika periode laporan mencakup hari ini, ambil data cuaca spesifik hari ini.
    // Ini memastikan laporan untuk bulan berjalan selalu menggunakan data suhu terbaru.
    const todayUTC = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );
    if (endDate >= todayUTC && startDate <= todayUTC) {
      todayWeather = await weatherService.getForecast(today); // getForecast akan mengisi cache jika perlu
    }

    // PERBAIKAN TOTAL: Logika diubah untuk melakukan agregasi langsung pada DailySummary.
    // Ini menghindari penghitungan ganda (WBP + LWBP + Total) yang terjadi saat
    // melakukan agregasi pada SummaryDetail.
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
      // BARU: Ambil data suhu rata-rata untuk periode yang sama
      prisma.weatherHistory.aggregate({
        where: { data_date: { gte: startDate, lte: endDate } },
        _avg: { avg_temp: true, max_temp: true }, // BARU: Ambil juga rata-rata suhu maksimal
      }),
    ]);

    if (aggregates.length === 0) {
      // PERBAIKAN: Pastikan semua properti dari tipe MonthlyData dikembalikan
      return {
        totalPax: paxAggregate._sum.total_pax ?? 0,
        summary: [],
        avgTemp: weatherAggregate._avg.avg_temp?.toNumber() ?? 0,
        avgMaxTemp: weatherAggregate._avg.max_temp?.toNumber() ?? 0,
        todayTemp: todayWeather // Gunakan hasil langsung
          ? {
              avg_temp: todayWeather.suhu_rata,
              max_temp: todayWeather.suhu_max,
            }
          : null,
      };
    }

    // Ambil detail meter untuk mendapatkan tipe energi
    const meterIds = aggregates.map((agg) => agg.meter_id);
    const meters = await prisma.meter.findMany({
      where: { meter_id: { in: meterIds } },
      include: { energy_type: true },
    });
    const meterMap = new Map(meters.map((m) => [m.meter_id, m]));

    // Gabungkan hasil agregasi berdasarkan tipe energi
    const summaryMap = new Map<string, any>();
    for (const agg of aggregates) {
      const meter = meterMap.get(agg.meter_id);
      if (!meter) continue;

      const energyTypeName = meter.energy_type.type_name;
      const current = summaryMap.get(energyTypeName) || {
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
      // PERBAIKAN: Tambahkan avgTemp ke objek yang dikembalikan
      avgTemp: weatherAggregate._avg.avg_temp?.toNumber() ?? 0,
      avgMaxTemp: weatherAggregate._avg.max_temp?.toNumber() ?? 0,
      todayTemp: todayWeather // Gunakan hasil langsung
        ? { avg_temp: todayWeather.suhu_rata, max_temp: todayWeather.suhu_max }
        : null,
    };
  }

  // HELPER BARU: Menghitung persentase perubahan dengan aman
  private _calculatePercentageChange(
    current: number,
    previous: number
  ): number | null {
    if (previous === 0) {
      // Jika sebelumnya 0 dan sekarang ada nilainya, perubahan tidak terhingga.
      // Kembalikan null untuk diinterpretasikan di frontend.
      return current > 0 ? null : 0;
    }
    const change = ((current - previous) / previous) * 100;
    return parseFloat(change.toFixed(2)); // Bulatkan ke 2 desimal
  }

  
}

export const dailySummaryService = new DailySummaryService();
