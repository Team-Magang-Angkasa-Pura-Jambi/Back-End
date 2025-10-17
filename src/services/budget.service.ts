import { Prisma } from '../generated/prisma/index.js';
import prisma from '../configs/db.js';
import { BaseService } from '../utils/baseService.js';
import { Error404 } from '../utils/customError.js';

export class BudgetService extends BaseService {
  constructor() {
    super(prisma);
  }

  /**
   * Menganalisis anggaran tahunan, menghitung realisasi, dan membuat/memperbarui
   * target efisiensi untuk sisa periode.
   * @param year - Tahun anggaran yang akan dianalisis.
   * @param pjjRate - Rate Pajak Penerangan Jalan (e.g., 0.09 untuk 9%).
   */
  public async processAnnualBudgetAndSetTargets(
    pjjRate: number,
    processDate?: Date
  ): Promise<any> {
    return this._handleCrudOperation(async () => {
      // PERBAIKAN: Definisikan referenceDate dengan benar
      const referenceDate = processDate
        ? new Date(
            Date.UTC(
              processDate.getUTCFullYear(),
              processDate.getUTCMonth(),
              processDate.getUTCDate()
            )
          )
        : new Date(
            Date.UTC(
              new Date().getUTCFullYear(),
              new Date().getUTCMonth(),
              new Date().getUTCDate()
            )
          );

      const activeBudget = await this._prisma.annualBudget.findFirst({
        where: {
          period_start: { lte: referenceDate },
          period_end: { gte: referenceDate },
          // BARU: Pastikan hanya mengambil anggaran untuk Listrik
          energy_type: {
            type_name: 'Electricity',
          },
        },
        // BARU: Sertakan data alokasi
        include: {
          allocations: { include: { meter: true } },
        },
      });

      if (!activeBudget) {
        throw new Error404(
          `Tidak ada periode anggaran aktif yang ditemukan untuk hari ini.`
        );
      }

      const {
        period_start: budgetPeriodStart,
        period_end: budgetPeriodEnd,
        total_budget: periodBudget,
        efficiency_tag: efficiencyTarget,
      } = activeBudget;

      // 2. Tentukan periode realisasi (dari awal periode anggaran hingga kemarin)
      const realizationEndDate = new Date(referenceDate);
      realizationEndDate.setUTCDate(realizationEndDate.getUTCDate() - 1);

      // BARU: Ambil juga total konsumsi historis untuk menghitung harga rata-rata per kWh
      const historicalConsumptionResult =
        await this._prisma.dailySummary.aggregate({
          _sum: {
            total_consumption: true,
          },
          where: {
            // Hitung dari awal periode anggaran
            summary_date: { gte: budgetPeriodStart, lte: realizationEndDate },
            meter: { energy_type: { type_name: 'Electricity' } },
          },
        });

      // 3. Hitung Realisasi (biaya aktual) dari DailySummary
      const realizationResult = await this._prisma.dailySummary.aggregate({
        _sum: {
          total_cost: true,
        },
        where: {
          // Hitung dari awal periode anggaran
          summary_date: { gte: budgetPeriodStart, lte: realizationEndDate },
          meter: {
            energy_type: { type_name: 'Electricity' },
          },
        },
      });
      const realizationCost =
        realizationResult._sum.total_cost ?? new Prisma.Decimal(0);
      const historicalConsumption =
        historicalConsumptionResult._sum.total_consumption ??
        new Prisma.Decimal(0);

      // 4. Lakukan semua kalkulasi sesuai urutan
      const target95 = periodBudget.times(efficiencyTarget);

      // Sisa Anggaran (dari target 95% dikurangi realisasi)
      const remainingBudgetWithPjj = target95.minus(realizationCost);

      // Sisa Anggaran setelah dikurangi PJJ
      const remainingBudgetNet = remainingBudgetWithPjj.div(1 + pjjRate);

      // 5. Tentukan periode untuk target baru (dari hari ini hingga akhir periode anggaran)
      const targetStartDate = referenceDate;
      const targetEndDate = budgetPeriodEnd;

      // Hitung sisa hari dalam periode target
      const remainingDays =
        (targetEndDate.getTime() - targetStartDate.getTime()) /
          (1000 * 60 * 60 * 24) +
        1;

      if (remainingDays <= 0) {
        console.log(
          'Periode anggaran telah berakhir. Tidak ada target baru yang dibuat.'
        );
        return { message: 'Periode anggaran telah berakhir.' };
      }

      // 6. Hitung Target Harian yang Baru
      const newDailyTargetCost = remainingBudgetNet.div(remainingDays);

      // BARU: Hitung target harian dalam kWh
      const avgPricePerKwh = historicalConsumption.isZero()
        ? new Prisma.Decimal(0)
        : realizationCost.div(historicalConsumption);

      const newDailyTargetKwh = avgPricePerKwh.isZero()
        ? new Prisma.Decimal(0)
        : newDailyTargetCost.div(avgPricePerKwh);

      // 7. Dapatkan semua alokasi dari anggaran aktif
      const allocations = activeBudget.allocations;
      if (allocations.length === 0) {
        throw new Error404(
          `Anggaran aktif ditemukan, tetapi tidak ada alokasi ke meteran manapun.`
        );
      }

      // Validasi total bobot alokasi (seharusnya mendekati 1)
      const totalWeight = allocations.reduce(
        (sum, alloc) => sum.plus(alloc.weight),
        new Prisma.Decimal(0)
      );
      if (Math.abs(totalWeight.toNumber() - 1) > 0.001) {
        console.warn(
          `[BudgetService] Peringatan: Total bobot alokasi untuk budget ID ${activeBudget.budget_id} adalah ${totalWeight.toFixed(4)}, bukan 1.`
        );
      }

      // 8. Buat atau perbarui EfficiencyTarget untuk semua meteran listrik
      // PERBAIKAN: Gunakan pendekatan Hapus-Lalu-Buat yang lebih aman daripada upsert yang kompleks.
      // Hapus semua target otomatis yang mungkin ada di masa depan untuk meter-meter ini.
      await this._prisma.efficiencyTarget.deleteMany({
        where: {
          meter_id: { in: allocations.map((alloc) => alloc.meter_id) },
          kpi_name: { contains: 'Target Biaya Harian Otomatis' },
          // Hapus target yang periodenya dimulai pada atau setelah hari ini
          period_start: {
            gte: new Date(
              Date.UTC(
                referenceDate.getUTCFullYear(),
                referenceDate.getUTCMonth(),
                referenceDate.getUTCDate()
              )
            ),
          },
        },
      });

      // PERBAIKAN: Gunakan tahun dari periode anggaran untuk penamaan KPI
      const budgetYear = budgetPeriodStart.getUTCFullYear();
      const createPromises = allocations.map((alloc) => {
        // PERBAIKAN: Hitung target per meter berdasarkan bobotnya
        const dailyTargetPerMeter = newDailyTargetCost.times(alloc.weight);
        const dailyKwhTargetPerMeter = newDailyTargetKwh.times(alloc.weight);

        return this._prisma.efficiencyTarget.create({
          data: {
            meter_id: alloc.meter_id,
            kpi_name: `Target Biaya Harian Otomatis - ${budgetYear}`,
            target_value: dailyKwhTargetPerMeter, // Simpan target kWh
            target_cost: dailyTargetPerMeter,
            period_start: targetStartDate,
            period_end: targetEndDate,
            set_by_user_id: 1, // ID user sistem atau admin default
          },
        });
      });

      await Promise.all(createPromises);

      return {
        message: `Target efisiensi berhasil diperbarui untuk ${allocations.length} meter berdasarkan alokasi bobot.`,
        calculationDetails: {
          periodBudget: periodBudget.toFixed(2),
          target95: target95.toFixed(2),
          realizationCost: realizationCost.toFixed(2),
          remainingBudgetNet: remainingBudgetNet.toFixed(2),
          remainingDays,
        },
      };
    });
  }
}

export const budgetService = new BudgetService();
