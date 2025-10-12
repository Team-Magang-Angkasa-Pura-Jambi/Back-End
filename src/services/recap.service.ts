// src/services/recap.service.ts
import prisma from '../configs/db.js';
import { socketServer } from '../socket-instance.js';
import { readingService } from './reading.service.js';
import type { Prisma } from '../generated/prisma/index.js';
import type {
  GetRecapQuery,
  RecapApiResponse,
  RecapDataRow,
  RecapSummary,
} from '../types/recap.types.js';
import { notificationService } from './notification.service.js';
import { BaseService } from '../utils/baseService.js';
// differenceInDays dan getDaysInMonth tidak lagi digunakan, bisa dihapus jika tidak ada pemakaian lain.

// Helper type untuk data agregat harian di dalam memori
type AggregatedDailyData = {
  costBeforeTax: number;
  costWithTax: number;
  wbp: number;
  lwbp: number; // PERBAIKAN: Nama properti konsisten
  consumption: number;
};

export class RecapService extends BaseService {
  constructor() {
    super(prisma);
  }

  public async getRecap(query: GetRecapQuery): Promise<RecapApiResponse> {
    const { energyType, startDate, endDate, sortBy, sortOrder, meterId } =
      query;

    return this._handleCrudOperation(async () => {
      // LANGKAH 1: Buat klausa 'where' yang dinamis dan ambil data relevan secara paralel
      const whereClause: Prisma.DailySummaryWhereInput = {
        meter: {
          energy_type: { type_name: energyType },
          // Filter meterId sekarang diterapkan jika ada
          ...(meterId && { meter_id: meterId }),
        },
        summary_date: { gte: startDate, lte: endDate },
      };

      // DIUBAH: Tambahkan pengambilan data EfficiencyTarget
      // Target hanya diambil jika meterId spesifik disediakan
      const fetchTargetsPromise = meterId
        ? this._prisma.efficiencyTarget.findMany({
            where: {
              meter_id: meterId,
              // Ambil target yang periodenya bersinggungan dengan rentang tanggal query
              period_start: { lte: endDate },
              period_end: { gte: startDate },
            },
          })
        : Promise.resolve([]); // Jika tidak ada meterId, kembalikan array kosong

      const [summaries, paxData, efficiencyTargets] = await Promise.all([
        this._prisma.dailySummary.findMany({
          where: whereClause,
          // PERBAIKAN: Gunakan 'select' untuk mengambil kolom skalar dan relasi
          select: {
            summary_date: true,
            total_cost: true,
            total_consumption: true, // Ambil total konsumsi langsung
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
      ]);

      // LANGKAH 2: Agregasi semua summary berdasarkan tanggal. Ini penting jika ada >1 meter.
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

        // PERBAIKAN: Hitung biaya termasuk pajak untuk rekap
        const costBeforeTax = summary.total_cost?.toNumber() ?? 0;

        // Cari skema harga yang relevan untuk tanggal summary
        const relevantPriceScheme =
          summary.meter.tariff_group.price_schemes.find(
            (ps) => ps.effective_date <= summary.summary_date && ps.is_active
          );

        // Hitung total rate pajak dari skema tersebut
        const totalTaxRate =
          relevantPriceScheme?.taxes.reduce(
            (acc, taxOnScheme) => acc + (taxOnScheme.tax.rate.toNumber() ?? 0),
            0
          ) ?? 0;

        const taxAmount = costBeforeTax * totalTaxRate;
        const costWithTax = costBeforeTax + taxAmount;

        currentData.costBeforeTax += costBeforeTax;
        currentData.costWithTax += costWithTax;

        // PERBAIKAN TOTAL: Logika agregasi konsumsi yang benar.
        if (energyType === 'Electricity') {
          // Untuk Listrik, kita perlu menjumlahkan WBP dan LWBP dari detailnya.
          const wbpDetail = summary.details.find(
            (d) => d.metric_name === 'Pemakaian WBP'
          );
          const lwbpDetail = summary.details.find(
            (d) => d.metric_name === 'Pemakaian LWBP'
          );

          currentData.wbp += wbpDetail?.consumption_value.toNumber() ?? 0;
          currentData.lwbp += lwbpDetail?.consumption_value.toNumber() ?? 0;
          // Konsumsi total untuk listrik adalah jumlah dari WBP dan LWBP.
          currentData.consumption = currentData.wbp + currentData.lwbp;
        } else {
          // Untuk jenis energi lain, kita bisa langsung menggunakan total_consumption.
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

      // LANGKAH 3: Buat kerangka laporan dengan mengisi hari yang kosong dan mencari target
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

        // DIUBAH: Cari target yang berlaku untuk tanggal saat ini
        const targetRecord = efficiencyTargets.find(
          (t) => currentDate >= t.period_start && currentDate <= t.period_end
        );
        const targetForDay = targetRecord
          ? targetRecord.target_value.toNumber()
          : null;

        // PERBAIKAN: Temukan summary yang sesuai untuk tanggal saat ini dari array `summaries`
        const summaryForDate = summaries.find(
          (s) => s.summary_date.toISOString().split('T')[0] === dateString
        );

        data.push({
          date: currentDate,
          wbp: summaryForDay?.wbp ?? null,
          lwbp: summaryForDay?.lwbp ?? null,
          consumption: summaryForDay?.consumption ?? null,
          classification:
            summaryForDate?.classification?.classification ?? null,
          target: targetForDay, // DIUBAH: Mengisi nilai target harian
          pax: paxForDay,
          // PERBAIKAN: Tampilkan biaya harian SEBELUM pajak
          cost: summaryForDay?.costBeforeTax ?? null,
        });
      }

      // LANGKAH 4: Lakukan pengurutan (sorting) jika diminta
      if (sortBy) {
        data.sort((a, b) => {
          const valA = sortBy === 'date' ? a.date.getTime() : (a[sortBy] ?? -1);
          const valB = sortBy === 'date' ? b.date.getTime() : (b[sortBy] ?? -1);
          const comparison = valA > valB ? 1 : valA < valB ? -1 : 0;
          return sortOrder === 'desc' ? comparison * -1 : comparison;
        });
      }

      // LANGKAH 5: Hitung total agregat dari data yang sudah diproses
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
    // PERBAIKAN: Gunakan data yang sudah diagregasi untuk mendapatkan total biaya
    // sebelum dan sesudah pajak secara akurat tanpa menghitung ulang.
    let totalCost = 0;
    let totalCostBeforeTax = 0;
    let totalWbp = 0;
    let totalLwbp = 0;
    let totalConsumption = 0;
    let totalPax = 0;
    let totalTarget = 0;

    for (const row of data) {
      const summary = aggregatedData.get(row.date.toISOString().split('T')[0]);
      totalCost += summary?.costWithTax ?? 0;
      totalCostBeforeTax += summary?.costBeforeTax ?? 0;
      totalWbp += row.wbp ?? 0;
      totalLwbp += row.lwbp ?? 0;
      // PERBAIKAN: Sederhanakan kalkulasi. `row.consumption` sekarang selalu benar.
      totalConsumption += row.consumption ?? 0;
      totalPax += row.pax ?? 0;
      totalTarget += row.target ?? 0;
    }

    return {
      totalCost,
      totalCostBeforeTax,
      totalTarget, // DIUBAH: Sekarang dihitung dari data
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
    userId?: number // PERBAIKAN: Terima userId untuk notifikasi
  ): Promise<void> {
    // PERBAIKAN: Fungsi ini sekarang berjalan di latar belakang.
    // Error handling harus dilakukan di dalam fungsi ini, tidak lagi dilempar ke controller.
    const jobDescription = `recalculate-${meterId || 'all'}-${Date.now()}`;
    console.log(
      `[BACKGROUND JOB - ${jobDescription}] Memulai kalkulasi ulang dari ${startDate.toISOString()} hingga ${endDate.toISOString()}`
    );

    const notifyUser = (event: string, data: unknown) => {
      if (userId) {
        socketServer.io.to(String(userId)).emit(event, data);
      }
    };

    try {
      const where: Prisma.ReadingSessionWhereInput = {
        reading_date: { gte: startDate, lte: endDate },
        ...(meterId && { meter_id: meterId }),
      };

      const sessionsToRecalculate = await this._prisma.readingSession.findMany({
        where,
      });

      if (sessionsToRecalculate.length === 0) {
        console.log(
          `[BACKGROUND JOB - ${jobDescription}] Tidak ada sesi untuk dihitung ulang.`
        );
        notifyUser('recalculation:success', {
          message: 'Tidak ada data yang perlu dihitung ulang.',
          processed: 0,
          total: 0,
        });
        return;
      }

      const totalSessions = sessionsToRecalculate.length;
      console.log(
        `[BACKGROUND JOB - ${jobDescription}] Ditemukan ${totalSessions} sesi untuk dihitung ulang.`
      );

      for (let i = 0; i < totalSessions; i++) {
        const session = sessionsToRecalculate[i];
        const progress = { processed: i + 1, total: totalSessions };

        // Kirim progres ke client
        notifyUser('recalculation:progress', progress);

        await readingService.processAndSummarizeReading(
          session.meter_id,
          session.reading_date
        );
      }

      console.log(
        `[BACKGROUND JOB - ${jobDescription}] Kalkulasi ulang selesai dengan sukses.`
      );
      notifyUser('recalculation:success', {
        message: `Kalkulasi ulang berhasil untuk ${totalSessions} data.`,
        processed: totalSessions,
        total: totalSessions,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[BACKGROUND JOB - ${jobDescription}] Error:`,
        errorMessage
      );
      notifyUser('recalculation:error', { message: errorMessage });

      // BARU: Kirim notifikasi permanen ke semua SuperAdmin jika terjadi error.
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

      // Di sini Anda bisa menambahkan logging ke file atau sistem monitoring lain.
    }
  }
}
export const recapService = new RecapService();
//
