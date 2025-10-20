import prisma from '../configs/db.js';
import { Prisma, type AnnualBudget } from '../generated/prisma/index.js';
import type {
  AllocationData,
  CreateAnnualBudgetBody,
  UpdateAnnualBudgetBody,
} from '../types/annualBudget.types.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';
import { Error400 } from '../utils/customError.js';

export class AnnualBudgetService extends GenericBaseService<
  typeof prisma.annualBudget,
  AnnualBudget,
  CreateAnnualBudgetBody,
  UpdateAnnualBudgetBody,
  Prisma.AnnualBudgetFindManyArgs,
  Prisma.AnnualBudgetFindUniqueArgs,
  Prisma.AnnualBudgetCreateArgs,
  Prisma.AnnualBudgetUpdateArgs,
  Prisma.AnnualBudgetDeleteArgs
> {
  constructor() {
    super(prisma, prisma.annualBudget, 'budget_id');
  }

  /**
   * Override metode create untuk menangani pembuatan AnnualBudget beserta
   * alokasinya (BudgetAllocation) dalam satu transaksi.
   * @param data - Data untuk membuat anggaran baru, termasuk array alokasi.
   * @returns Anggaran yang baru dibuat beserta alokasinya.
   */
  public override async create(
    data: CreateAnnualBudgetBody
  ): Promise<AnnualBudget> {
    const { allocations, parent_budget_id, ...budgetData } = data;

    return this._handleCrudOperation(async () => {
      // Jika ini adalah anggaran anak, lakukan validasi tambahan
      if (parent_budget_id) {
        // 1. Pastikan induknya ada dan merupakan anggaran induk
        const parentBudget = await this._prisma.annualBudget.findUnique({
          where: { budget_id: parent_budget_id },
        });
        if (!parentBudget || parentBudget.parent_budget_id !== null) {
          throw new Error400('ID anggaran induk tidak valid.');
        }

        // PERBAIKAN: Lakukan perbandingan tanggal tanpa terpengaruh zona waktu.
        // Set jam ke 0 untuk memastikan perbandingan hanya berdasarkan tanggal.
        const childStartDate = new Date(budgetData.period_start);
        childStartDate.setUTCHours(0, 0, 0, 0);
        const childEndDate = new Date(budgetData.period_end);
        childEndDate.setUTCHours(0, 0, 0, 0);

        const parentStartDate = new Date(parentBudget.period_start);
        parentStartDate.setUTCHours(0, 0, 0, 0);
        const parentEndDate = new Date(parentBudget.period_end);
        parentEndDate.setUTCHours(0, 0, 0, 0);

        if (childStartDate < parentStartDate || childEndDate > parentEndDate) {
          console.log(
            childStartDate,
            parentStartDate,
            childEndDate,
            parentEndDate
          );

          throw new Error400(
            'Periode anggaran anak harus berada di dalam rentang periode anggaran induk.'
          );
        }
      }

      // Jika ini adalah anggaran induk, pastikan tidak ada alokasi yang dikirim
      if (!parent_budget_id && allocations && allocations.length > 0) {
        throw new Error400(
          'Anggaran induk (tahunan) tidak boleh memiliki alokasi meter langsung. Alokasi dibuat pada anggaran periode (anak).'
        );
      }

      return this._prisma.annualBudget.create({
        data: {
          ...budgetData,
          parent_budget_id,
          // Hanya buat alokasi jika ada dan diizinkan
          ...(allocations && allocations.length > 0
            ? {
                allocations: {
                  createMany: { data: allocations },
                },
              }
            : {}),
        },
        include: { allocations: true },
      });
    });
  }

  /**
   * BARU: Override metode update untuk menangani pembaruan AnnualBudget beserta
   * alokasinya (BudgetAllocation) dalam satu transaksi.
   * @param budgetId - ID dari anggaran yang akan diperbarui.
   * @param data - Data baru untuk anggaran, bisa termasuk array alokasi baru.
   * @returns Anggaran yang telah diperbarui beserta alokasinya.
   */
  public override async update(
    budgetId: number,
    data: UpdateAnnualBudgetBody
  ): Promise<AnnualBudget> {
    const { allocations, ...budgetData } = data;

    return this._handleCrudOperation(async () => {
      return this._prisma.$transaction(async (tx) => {
        // Jika ada data alokasi baru, hapus yang lama terlebih dahulu.
        if (allocations && allocations.length > 0) {
          await tx.budgetAllocation.deleteMany({
            where: { budget_id: budgetId },
          });
        }

        // Perbarui data anggaran utama dan buat alokasi baru jika ada.
        const updatedBudget = await tx.annualBudget.update({
          where: { budget_id: budgetId },
          data: {
            ...budgetData,
            ...(allocations && {
              allocations: { createMany: { data: allocations } },
            }),
          },
          // PERBAIKAN: Sertakan relasi lengkap untuk respons yang konsisten.
          include: {
            allocations: true,
            child_budgets: true,
            parent_budget: true,
            energy_type: true,
          },
        });

        return updatedBudget;
      });
    });
  }

  /**
   * BARU: Mengambil detail lengkap dari satu anggaran, termasuk alokasi bulanan
   * dan rincian realisasi per meter.
   * @param budgetId - ID dari AnnualBudget yang akan diambil.
   */
  public async getDetailedBudgetById(budgetId: number) {
    return this._handleCrudOperation(async () => {
      const budget = await this._prisma.annualBudget.findUniqueOrThrow({
        where: { budget_id: budgetId },
        include: {
          energy_type: true,
          allocations: {
            include: {
              meter: { select: { meter_id: true, meter_code: true } },
            },
          },
          // BARU: Sertakan juga data anak dan induk saat mengambil detail
          child_budgets: true,
          parent_budget: true,
        },
      });

      const {
        period_start,
        period_end,
        total_budget,
        allocations,
        child_budgets,
      } = budget;

      const isParentBudget = !budget.parent_budget_id;

      // --- 1. Kalkulasi Alokasi & Realisasi Bulanan (Hanya untuk anggaran anak) ---
      const monthlyAllocation: {
        month: number;
        monthName: string;
        allocatedBudget: number;
        realizationCost: number;
        remainingBudget: number;
        realizationPercentage: number | null;
      }[] = [];

      if (!isParentBudget && allocations.length > 0) {
        const periodDays =
          (period_end.getTime() - period_start.getTime()) /
            (1000 * 60 * 60 * 24) +
          1;
        const budgetPerDay =
          periodDays > 0 ? total_budget.div(periodDays) : new Prisma.Decimal(0);

        const meterIds = allocations.map((alloc) => alloc.meter_id);
        const monthlyRealisations: { month: number; total_cost: number }[] =
          await this._prisma.$queryRaw`
              SELECT EXTRACT(MONTH FROM summary_date)::int as month, SUM(total_cost) as total_cost
              FROM "daily_summaries"
              WHERE meter_id = ANY(ARRAY[${Prisma.join(meterIds)}])
                AND summary_date >= ${period_start} AND summary_date <= ${period_end}
              GROUP BY month ORDER BY month;`;

        const monthlyRealizationMap = new Map(
          monthlyRealisations.map((r) => [
            r.month,
            new Prisma.Decimal(r.total_cost),
          ])
        );

        for (
          let d = new Date(period_start);
          d <= period_end;
          d.setUTCMonth(d.getUTCMonth() + 1)
        ) {
          const currentMonth = d.getUTCMonth();
          const currentYear = d.getUTCFullYear();
          const monthStartDate = new Date(
            Date.UTC(currentYear, currentMonth, 1)
          );
          const monthEndDate = new Date(
            Date.UTC(currentYear, currentMonth + 1, 0)
          );

          const overlapStart = new Date(
            Math.max(monthStartDate.getTime(), period_start.getTime())
          );
          const overlapEnd = new Date(
            Math.min(monthEndDate.getTime(), period_end.getTime())
          );

          if (overlapEnd >= overlapStart) {
            const daysInMonthOverlap =
              (overlapEnd.getTime() - overlapStart.getTime()) /
                (1000 * 60 * 60 * 24) +
              1;
            const budgetForMonth = budgetPerDay.times(daysInMonthOverlap);
            const realizationForMonth =
              monthlyRealizationMap.get(currentMonth + 1) ??
              new Prisma.Decimal(0);
            const remainingForMonth = budgetForMonth.minus(realizationForMonth);
            const percentageForMonth = budgetForMonth.isZero()
              ? null
              : realizationForMonth.div(budgetForMonth).times(100);

            monthlyAllocation.push({
              month: currentMonth + 1,
              monthName: monthStartDate.toLocaleString('id-ID', {
                month: 'long',
              }),
              allocatedBudget: budgetForMonth.toNumber(),
              realizationCost: realizationForMonth.toNumber(),
              remainingBudget: remainingForMonth.toNumber(),
              realizationPercentage:
                percentageForMonth !== null
                  ? parseFloat(percentageForMonth.toFixed(2))
                  : null,
            });
          }
        }
      }

      // --- 2. Kalkulasi Realisasi per Meter (Hanya untuk anggaran anak) ---
      const meterIds = allocations.map((alloc) => alloc.meter_id);
      const meterRealisations = await this._prisma.dailySummary.groupBy({
        by: ['meter_id'],
        where: {
          meter_id: { in: meterIds.length > 0 ? meterIds : [-1] },
          summary_date: { gte: period_start, lte: period_end },
        },
        _sum: { total_cost: true },
      });
      const meterRealizationMap = new Map(
        meterRealisations.map((r) => [r.meter_id, r._sum.total_cost ?? 0])
      );

      const detailedAllocations = allocations.map((alloc) => {
        const allocatedBudget = total_budget.times(alloc.weight);
        const totalRealization = new Prisma.Decimal(
          meterRealizationMap.get(alloc.meter_id) ?? 0
        );
        const remainingBudget = allocatedBudget.minus(totalRealization);
        const realizationPercentage = allocatedBudget.isZero()
          ? null
          : totalRealization.div(allocatedBudget).times(100);

        return {
          ...alloc,
          allocatedBudget: allocatedBudget.toNumber(),
          totalRealization: totalRealization.toNumber(),
          remainingBudget: remainingBudget.toNumber(),
          realizationPercentage:
            realizationPercentage !== null
              ? parseFloat(realizationPercentage.toFixed(2))
              : null,
        };
      });

      // --- 3. BARU: Jika ini adalah anggaran induk, agregat realisasi dari anak-anaknya ---
      let parentRealization = {
        totalRealization: 0,
        remainingBudget: budget.total_budget.toNumber(),
        realizationPercentage: 0,
      };

      if (isParentBudget) {
        // PERBAIKAN: Hitung total realisasi dengan menjumlahkan realisasi dari setiap anak
        // sesuai dengan periode masing-masing anak.
        let totalRealization = new Prisma.Decimal(0);
        // PERBAIKAN: Berikan tipe eksplisit untuk 'child' untuk membantu transpiler.
        for (const child of budget.child_budgets as Prisma.AnnualBudgetGetPayload<{
          include: { allocations: { select: { meter_id: true } } };
        }>[]) {
          const childMeterIds = child?.allocations?.map(
            (a: { meter_id: number }) => a.meter_id
          );
          if (childMeterIds?.length > 0) {
            const childRealizationResult =
              await this._prisma.dailySummary.aggregate({
                _sum: { total_cost: true },
                where: {
                  meter_id: { in: childMeterIds },
                  summary_date: {
                    gte: child.period_start,
                    lte: child.period_end,
                  },
                },
              });
            totalRealization = totalRealization.plus(
              childRealizationResult._sum.total_cost ?? new Prisma.Decimal(0)
            );
          }
        }
        const remainingBudget = total_budget.minus(totalRealization);
        const realizationPercentage = total_budget.isZero()
          ? 0
          : totalRealization.div(total_budget).times(100).toNumber();

        parentRealization.totalRealization = totalRealization.toNumber();
        parentRealization.remainingBudget = remainingBudget.toNumber();
        parentRealization.realizationPercentage = parseFloat(
          realizationPercentage.toFixed(2)
        );
      }

      return {
        ...budget,
        allocations: detailedAllocations,
        monthlyAllocation,
        ...(isParentBudget ? { parentRealization } : {}),
      };
    });
  }

  /**
   * BARU: Mengambil daftar anggaran dengan detail lengkap untuk setiap item.
   * @param args - Argumen findMany dari Prisma untuk filtering dan paginasi.
   */
  public async getDetailedBudgets(args: Prisma.AnnualBudgetFindManyArgs) {
    return this._handleCrudOperation(async () => {
      // PERBAIKAN: Logika disederhanakan untuk mengambil semua ID anggaran yang cocok
      // lalu memanggil getDetailedBudgetById untuk setiap anggaran.
      // Ini memastikan konsistensi kalkulasi dan menghindari duplikasi kode.

      // 1. Ambil ID dari semua anggaran yang cocok dengan filter.
      const budgets = await this._prisma.annualBudget.findMany({
        ...args,
        where: { parent_budget_id: { not: null } },
        // PERBAIKAN: Hapus filter 'where' yang salah agar bisa mengambil semua jenis anggaran.
        // Filter yang benar sudah ada di dalam '...args'.
        select: { budget_id: true }, // Hanya ambil ID untuk efisiensi
      });

      if (budgets.length === 0) {
        return [];
      }

      // 2. Panggil getDetailedBudgetById untuk setiap ID secara paralel.
      const detailedBudgets = await Promise.all(
        budgets.map((b) => this.getDetailedBudgetById(b.budget_id))
      );

      return detailedBudgets;
    });
  }
  /**
   * BARU: Mengambil daftar anggaran INDUK (tahunan) dengan detail ringkas.
   * @param args - Argumen findMany dari Prisma untuk filtering dan paginasi.
   */
  public async getParentBudgets(args: Prisma.AnnualBudgetFindManyArgs) {
    return this._handleCrudOperation(async () => {
      // 1. Ambil semua data anggaran induk yang cocok dengan filter
      const parentBudgets = await this._prisma.annualBudget.findMany({
        ...args,
        where: {
          ...args.where, // Gabungkan dengan filter dari query (misal: tanggal)
          parent_budget_id: null, // Ambil HANYA anggaran induk
        },
        include: {
          energy_type: true,
          // Sertakan anak dan alokasinya untuk kalkulasi realisasi
          child_budgets: {
            orderBy: { period_start: 'asc' },
            include: {
              allocations: {
                select: { meter_id: true },
              },
            },
          },
        },
      });

      if (parentBudgets.length === 0) {
        return [];
      }

      // 2. Proses setiap anggaran induk untuk menambahkan kalkulasi realisasi
      const detailedParentBudgetsPromises = parentBudgets.map(
        async (budget) => {
          const { total_budget } = budget;

          // Kalkulasi realisasi untuk anggaran induk
          let totalRealization = new Prisma.Decimal(0);
          // PERBAIKAN: Berikan tipe eksplisit untuk 'child' untuk membantu transpiler.
          for (const child of budget.child_budgets as Prisma.AnnualBudgetGetPayload<{
            include: { allocations: { select: { meter_id: true } } };
          }>[]) {
            const childMeterIds = child.allocations.map((a) => a.meter_id);

            if (childMeterIds.length > 0) {
              const childRealizationResult =
                await this._prisma.dailySummary.aggregate({
                  _sum: { total_cost: true },
                  where: {
                    meter_id: { in: childMeterIds },
                    summary_date: {
                      gte: child.period_start,
                      lte: child.period_end,
                    },
                  },
                });
              totalRealization = totalRealization.plus(
                childRealizationResult._sum.total_cost ?? new Prisma.Decimal(0)
              );
            }
          }

          const remainingBudget = total_budget.minus(totalRealization);
          const realizationPercentage = total_budget.isZero()
            ? null
            : totalRealization.div(total_budget).times(100).toNumber();

          return {
            ...budget,
            parentRealization: {
              totalRealization: totalRealization.toNumber(),
              remainingBudget: remainingBudget.toNumber(),
              realizationPercentage:
                realizationPercentage !== null
                  ? parseFloat(realizationPercentage.toFixed(2))
                  : null,
            },
          };
        }
      );

      return Promise.all(detailedParentBudgetsPromises);
    });
  }
}

export const annualBudgetService = new AnnualBudgetService();
