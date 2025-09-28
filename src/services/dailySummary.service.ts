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
  ): Promise<MonthlySummaryReport> {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Mendefinisikan semua logika di dalam sebuah fungsi untuk dieksekusi oleh error handler
    const buildReport = async (): Promise<MonthlySummaryReport> => {
      // LANGKAH 1: Lakukan semua query agregasi secara paralel untuk efisiensi
      const [detailAggregates, paxAggregate] = await Promise.all([
        // Query untuk menjumlahkan konsumsi dan biaya, dikelompokkan per jenis energi
        prisma.summaryDetail.groupBy({
          by: ['energy_type_id'],
          where: {
            summary: {
              summary_date: { gte: startDate, lte: endDate },
            },
          },
          _sum: {
            consumption_value: true,
            consumption_cost: true,
          },
        }),
        // Query untuk menjumlahkan total pax dari tabel PaxData
        prisma.paxData.aggregate({
          where: {
            data_date: { gte: startDate, lte: endDate },
          },
          _sum: {
            total_pax: true,
          },
        }),
      ]);

      // Jika tidak ada data konsumsi sama sekali, kembalikan laporan kosong
      if (detailAggregates.length === 0) {
        return this.buildEmptyReport(year, month, startDate, endDate);
      }

      // LANGKAH 2: Ambil data pendukung (detail EnergyType)
      const energyTypeIds = detailAggregates.map((agg) => agg.energy_type_id);
      const energyTypes = await prisma.energyType.findMany({
        where: {
          energy_type_id: { in: energyTypeIds },
        },
      });
      // Buat Map untuk pencarian cepat (O(1) lookup)
      const energyTypeMap = new Map(
        energyTypes.map((et) => [et.energy_type_id, et])
      );

      // LANGKAH 3: Bangun hasil summary dari data agregasi
      const summary = detailAggregates.map((agg) => {
        const energyType = energyTypeMap.get(agg.energy_type_id);

        // Konversi hasil 'Decimal' dari Prisma menjadi 'number' biasa
        const totalConsumption = agg._sum.consumption_value?.toNumber() ?? 0;
        const totalCost = agg._sum.consumption_cost?.toNumber() ?? 0;

        return {
          energyType: energyType?.type_name || 'Unknown',
          unit: energyType?.unit_of_measurement || '',
          totalConsumption,
          totalCost,
        };
      });

      // Ambil hasil total pax dari agregasi
      const totalPax = paxAggregate._sum.total_pax ?? 0;

      // LANGKAH 4: Format informasi periode laporan
      const reportPeriod = {
        year,
        month,
        monthName: new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(
          startDate
        ),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      // Gabungkan semua bagian menjadi satu laporan akhir
      const finalReport: MonthlySummaryReport = {
        reportPeriod,
        totalPax,
        summary,
      };

      return finalReport;
    };

    // Jalankan fungsi logika di dalam error handler yang sudah ada
    return this._handleCrudOperation(buildReport);
  }

  // Pastikan Anda memiliki metode helper ini
  private buildEmptyReport(
    year: number,
    month: number,
    startDate: Date,
    endDate: Date
  ): MonthlySummaryReport {
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
      totalPax: 0,
      summary: [],
    };
  }
}

export const dailySummaryService = new DailySummaryService();
