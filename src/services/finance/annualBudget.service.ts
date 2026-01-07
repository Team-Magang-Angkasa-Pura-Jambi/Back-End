import prisma from '../../configs/db.js';
import {
  BudgetAllocation,
  Prisma,
  type AnnualBudget,
} from '../../generated/prisma/index.js';
import type {
  AllocationData,
  CreateAnnualBudgetBody,
  UpdateAnnualBudgetBody,
} from '../../types/finance/annualBudget.types.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';
import { Error400 } from '../../utils/customError.js';

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

  public async getAvailableYears(): Promise<{ availableYears: number[] }> {
    return this._handleCrudOperation(async () => {
      const budgets = await prisma.annualBudget.findMany({
        select: {
          period_start: true,
        },
        orderBy: { period_start: 'desc' },
      });

      const dbYears = budgets.map((b) =>
        new Date(b.period_start).getFullYear()
      );

      const currentYear = new Date().getFullYear();
      const mandatoryYears = [currentYear, currentYear + 1];

      const uniqueYears = new Set([...dbYears, ...mandatoryYears]);

      return { availableYears: Array.from(uniqueYears).sort((a, b) => b - a) };
    });
  }

  public async getDetailedBudgets(args: Prisma.AnnualBudgetFindManyArgs) {
    return this._handleCrudOperation(async () => {
      // 1. Fetch Data Utama
      const budgets = await prisma.annualBudget.findMany({
        ...args,
        where: {
          ...args.where,
          // parent_budget_id: { not: null },
          // Hanya Child Budget
        },
        include: {
          energy_type: true,
          allocations: {
            include: {
              meter: {
                // 🔥 Tambahkan meter_name agar card di UI tampil lengkap
                select: { meter_id: true, meter_code: true },
              },
            },
          },
        },
        orderBy: args.orderBy || { period_start: 'asc' },
      });

      if (budgets.length === 0) return [];

      // 2. Siapkan Data untuk Batch Query
      const allMeterIds = new Set<number>();
      budgets.forEach((b) =>
        b.allocations.forEach((a) => {
          if (a.meter_id) allMeterIds.add(a.meter_id);
        })
      );

      // Cari range tanggal terluar
      const dates = budgets.flatMap((b) => [
        b.period_start.getTime(),
        b.period_end.getTime(),
      ]);
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));

      // 3. Batch Query: Ambil Realisasi (DailySummary)
      const rawRealisations = await prisma.dailySummary.groupBy({
        by: ['meter_id', 'summary_date'],
        _sum: { total_cost: true },
        where: {
          meter_id: { in: Array.from(allMeterIds) },
          summary_date: { gte: minDate, lte: maxDate },
        },
      });

      // 4. Mapping & Kalkulasi (Per Allocation -> Per Budget)
      const detailedBudgets = budgets.map((budget) => {
        const totalBudget = budget.total_budget.toNumber();

        // A. Hitung Realisasi PER METER (Allocation Level)
        const processedAllocations = budget.allocations.map((alloc) => {
          // Hitung Budget untuk meter ini (Total Budget * Bobot)
          const allocBudget = budget.total_budget
            .times(alloc.weight)
            .toNumber();

          // Filter realisasi khusus untuk meter ini di rentang tanggal budget ini
          const allocRealization = rawRealisations
            .filter((r) => {
              const rDate = new Date(r.summary_date);
              return (
                r.meter_id === alloc.meter_id &&
                rDate >= budget.period_start &&
                rDate <= budget.period_end
              );
            })
            .reduce((sum, r) => sum + (r._sum.total_cost?.toNumber() || 0), 0);

          const allocRemaining = allocBudget - allocRealization;
          const allocPercentage =
            allocBudget > 0 ? (allocRealization / allocBudget) * 100 : 0;

          return {
            ...alloc,
            // Pastikan object meter aman
            meter: alloc.meter || {
              meter_code: 'Unknown',
              meter_name: 'Unknown',
            },
            allocatedBudget: allocBudget,
            totalRealization: allocRealization,
            remainingBudget: allocRemaining,
            realizationPercentage: parseFloat(allocPercentage.toFixed(2)),
          };
        });

        // B. Hitung Total Realisasi Budget (Sum dari allocation di atas)
        // Ini memastikan angka di header budget sinkron dengan total kartu-kartu di bawahnya
        const totalRealization = processedAllocations.reduce(
          (acc, curr) => acc + curr.totalRealization,
          0
        );

        const remainingBudget = totalBudget - totalRealization;

        const realizationPercentage =
          totalBudget > 0 ? (totalRealization / totalBudget) * 100 : 0;

        return {
          ...budget,
          // 🔥 Return allocations yang sudah ada datanya
          allocations: processedAllocations,
          totalBudget,
          totalRealization,
          remainingBudget,
          realizationPercentage: parseFloat(realizationPercentage.toFixed(2)),
        };
      });

      return detailedBudgets;
    });
  }

  public override async create(
    data: CreateAnnualBudgetBody
  ): Promise<AnnualBudget> {
    const { allocations, parent_budget_id, ...budgetData } = data;

    return this._handleCrudOperation(async () => {
      // 1. Normalisasi Tanggal
      const childStartDate = new Date(budgetData.period_start);
      childStartDate.setUTCHours(0, 0, 0, 0);
      const childEndDate = new Date(budgetData.period_end);
      childEndDate.setUTCHours(23, 59, 59, 999);

      if (parent_budget_id) {
        const parentBudget = await prisma.annualBudget.findUnique({
          where: { budget_id: parent_budget_id },
        });

        if (!parentBudget || parentBudget.parent_budget_id !== null) {
          throw new Error400('ID anggaran induk tidak valid.');
        }

        // Validasi Overlap
        const overlapping = await prisma.annualBudget.findFirst({
          where: {
            parent_budget_id: parent_budget_id,
            period_start: { lte: childEndDate },
            period_end: { gte: childStartDate },
          },
        });

        if (overlapping) {
          throw new Error400(
            'Periode anggaran bertabrakan dengan yang sudah ada.'
          );
        }
      }

      // 2. Eksekusi Create
      // Gunakan parent_budget_id langsung sebagai nilai angka (Number)
      return prisma.annualBudget.create({
        data: {
          total_budget: budgetData.total_budget,
          efficiency_tag: budgetData.efficiency_tag,
          energy_type_id: budgetData.energy_type_id,
          period_start: childStartDate,
          period_end: childEndDate,

          // Perbaikan di sini: Gunakan field ID langsung
          parent_budget_id: parent_budget_id || null,

          ...(allocations &&
            allocations.length > 0 && {
              allocations: {
                createMany: {
                  data: allocations.map((a) => ({
                    meter_id: a.meter_id,
                    weight: a.weight,
                  })),
                },
              },
            }),
        },
        include: {
          allocations: { include: { meter: true } },
          energy_type: true,
        },
      });
    });
  }
  // ---------------------------------------

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
      return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        if (allocations && allocations.length > 0) {
          await tx.budgetAllocation.deleteMany({
            where: { budget_id: budgetId },
          });
        }

        const updatedBudget = await tx.annualBudget.update({
          where: { budget_id: budgetId },
          data: {
            ...budgetData,
            ...(allocations && {
              allocations: { createMany: { data: allocations } },
            }),
          } as any,

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
      const budget = await prisma.annualBudget.findUniqueOrThrow({
        where: { budget_id: budgetId },
        include: {
          energy_type: true,
          allocations: {
            include: {
              meter: { select: { meter_id: true, meter_code: true } },
            },
          },

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

        const meterIds = allocations.map((alloc: any) => alloc.meter_id);
        const monthlyRealisations: { month: number; total_cost: number }[] =
          await prisma.$queryRaw`
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

      const meterIds = allocations.map((alloc: any) => alloc.meter_id);
      const meterRealisations = await prisma.dailySummary.groupBy({
        by: ['meter_id'],
        where: {
          meter_id: { in: meterIds.length > 0 ? meterIds : [-1] },
          summary_date: { gte: period_start, lte: period_end },
        },
        _sum: { total_cost: true },
      });
      const meterRealizationMap = new Map(
        meterRealisations.map((r: any) => [r.meter_id, r._sum.total_cost ?? 0])
      );

      const detailedAllocations = allocations.map((alloc: any) => {
        const allocatedBudget = total_budget.times(alloc.weight);
        const totalRealization = new Prisma.Decimal(
          meterRealizationMap.get(alloc.meter_id) ?? (0 as any)
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

      let parentRealization = {
        totalRealization: 0,
        remainingBudget: budget.total_budget.toNumber(),
        realizationPercentage: 0,
      };

      if (isParentBudget) {
        let totalRealization = new Prisma.Decimal(0);

        for (const child of budget.child_budgets as Prisma.AnnualBudgetGetPayload<{
          include: { allocations: { select: { meter_id: true } } };
        }>[]) {
          const childMeterIds = child?.allocations?.map(
            (a: { meter_id: number }) => a.meter_id
          );
          if (childMeterIds?.length > 0) {
            const childRealizationResult = await prisma.dailySummary.aggregate({
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
   * BARU: Mengambil daftar anggaran INDUK (tahunan) dengan detail ringkas.
   * @param args - Argumen findMany dari Prisma untuk filtering dan paginasi.
   */
  public async getParentBudgets(args: Prisma.AnnualBudgetFindManyArgs) {
    return this._handleCrudOperation(async () => {
      const parentBudgets = await prisma.annualBudget.findMany({
        ...args,
        where: {
          ...args.where,
          parent_budget_id: null,
        },
        include: {
          energy_type: true,

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

      const detailedParentBudgetsPromises = parentBudgets.map(
        async (budget: any) => {
          const { total_budget } = budget;

          let totalRealization = new Prisma.Decimal(0);

          for (const child of budget.child_budgets as Prisma.AnnualBudgetGetPayload<{
            include: { allocations: { select: { meter_id: true } } };
          }>[]) {
            const childMeterIds = child.allocations.map((a) => a.meter_id);

            if (childMeterIds.length > 0) {
              const childRealizationResult =
                await prisma.dailySummary.aggregate({
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
