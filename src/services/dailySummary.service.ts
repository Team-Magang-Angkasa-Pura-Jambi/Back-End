import prisma from '../configs/db.js';
import type { DailySummary, Prisma } from '../generated/prisma/index.js';
import type { DefaultArgs } from '../generated/prisma/runtime/library.js';
import type {
  CreateSummaryBody,
  GetSummaryQuery,
  UpdateSummaryBody,
} from '../types/dailySummary.type.js';
import type { CustomErrorMessages } from '../utils/baseService.js';

import { GenericBaseService } from '../utils/GenericBaseService.js';

type DailySummaryQuery = Prisma.DailySummaryFindManyArgs & GetSummaryQuery;
type MonthlySummaryReport = {
  reportPeriod: {
    year: number;
    month: number;
    monthName: string;
    startDate: string;
    endDate: string;
  };
  totalPax: number;
  // PERBAIKAN: Tambahkan '[]' untuk menandakan bahwa ini adalah array
  summary: {
    energyType: string;
    totalConsumption: number;
    unit: string;
    totalCost: number;
  }[];
};
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

      // Jika tidak ada data di bulan ini, kembalikan laporan kosong
      if (currentData.summary.length === 0 && currentData.totalPax === 0) {
        return this.buildEmptyReport(
          year,
          month,
          currentStartDate,
          currentEndDate
        );
      }

      // LANGKAH 4: BANDINGKAN DATA
      // Buat Map dari data bulan lalu untuk pencarian cepat
      const previousSummaryMap = new Map(
        previousData.summary.map((s) => [s.energyType, s])
      );

      const summary: EnergySummary[] = currentData.summary.map(
        (currentSummary) => {
          const previousSummary = previousSummaryMap.get(
            currentSummary.energyType
          );

          const prevConsumption = previousSummary?.totalConsumption ?? 0;
          const prevCost = previousSummary?.totalCost ?? 0;

          return {
            energyType: currentSummary.energyType,
            unit: currentSummary.unit,
            totalConsumption: {
              currentValue: currentSummary.totalConsumption,
              previousValue: prevConsumption,
              percentageChange: this._calculatePercentageChange(
                currentSummary.totalConsumption,
                prevConsumption
              ),
            },
            totalCost: {
              currentValue: currentSummary.totalCost,
              previousValue: prevCost,
              percentageChange: this._calculatePercentageChange(
                currentSummary.totalCost,
                prevCost
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
        summary,
      };

      return finalReport;
    };

    return this._handleCrudOperation(buildReport);
  }

  private async _getMonthlyData(startDate: Date, endDate: Date) {
    const [detailAggregates, paxAggregate] = await Promise.all([
      prisma.summaryDetail.groupBy({
        by: ['energy_type_id'],
        where: {
          summary: {
            summary_date: { gte: startDate, lte: endDate },
          },
        },
        _sum: { consumption_value: true, consumption_cost: true },
      }),
      prisma.paxData.aggregate({
        where: { data_date: { gte: startDate, lte: endDate } },
        _sum: { total_pax: true },
      }),
    ]);

    if (detailAggregates.length === 0) {
      return { totalPax: paxAggregate._sum.total_pax ?? 0, summary: [] };
    }

    const energyTypeIds = detailAggregates.map((agg) => agg.energy_type_id);
    const energyTypes = await prisma.energyType.findMany({
      where: { energy_type_id: { in: energyTypeIds } },
    });
    const energyTypeMap = new Map(
      energyTypes.map((et) => [et.energy_type_id, et])
    );

    const summary = detailAggregates.map((agg) => {
      const energyType = energyTypeMap.get(agg.energy_type_id);
      return {
        energyType: energyType?.type_name || 'Unknown',
        unit: energyType?.unit_of_measurement || '',
        totalConsumption: agg._sum.consumption_value?.toNumber() ?? 0,
        totalCost: agg._sum.consumption_cost?.toNumber() ?? 0,
      };
    });

    return {
      totalPax: paxAggregate._sum.total_pax ?? 0,
      summary,
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

  // HELPER LAMA: Diperbarui agar sesuai dengan struktur data baru
  private buildEmptyReport(
    year: number,
    month: number,
    startDate: Date,
    endDate: Date
  ): MonthlyComparisonReport {
    return {
      reportPeriod: {
        year,
        month,
        monthName: new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(
          startDate
        ),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      totalPax: { currentValue: 0, previousValue: 0, percentageChange: 0 },
      summary: [],
    };
  }

  // Pastikan Anda memiliki metode helper ini
}

export const dailySummaryService = new DailySummaryService();
