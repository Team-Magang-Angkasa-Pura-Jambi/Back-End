import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type CreateBudgetPayload, type UpdateBudgetPayload } from './annual_budgets.type.js';

/**
 * Fungsi untuk membagi budget ke 12 bulan.
 * Jika efficiencyTarget = 0.05 (5%), maka spendable hanya 95% dari total amount.
 */
const generateMonthlyProfile = (amount: number, efficiencyTarget = 0) => {
  const efficiencyMultiplier = 1 - efficiencyTarget;
  const spendableAmount = amount * efficiencyMultiplier;
  const perMonth = spendableAmount / 12;

  const months = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ];
  const profile: Record<string, number> = {};

  months.forEach((m) => {
    profile[m] = Number(perMonth.toFixed(2));
  });

  return profile;
};

export const budgetService = {
  /**
   * Menambah Budget Tahunan Baru
   */
  store: async (payload: CreateBudgetPayload) => {
    try {
      const { budget } = payload;
      const efficiencyTarget = Number(budget.efficiency_target_percentage) || 0;

      // Injeksi profile bulanan otomatis jika tidak dikirim dari FE
      if (budget.allocations?.create) {
        const createData = Array.isArray(budget.allocations.create)
          ? budget.allocations.create
          : [budget.allocations.create];

        budget.allocations.create = createData.map((alloc) => ({
          ...alloc,
          monthly_distribution_profile:
            alloc.monthly_distribution_profile ??
            generateMonthlyProfile(Number(alloc.allocated_amount), efficiencyTarget),
        }));
      }

      return await prisma.annualBudget.create({
        data: budget as any,
        include: { allocations: true },
      });
    } catch (error) {
      return handlePrismaError(error, 'Annual Budget');
    }
  },

  /**
   * Mengubah Data Budget & Alokasi (Upsert Logic)
   */
  // budget.service.ts

  patch: async (id: number, payload: UpdateBudgetPayload) => {
    try {
      const { budget } = payload;

      // 1. Ambil data budget yang sekarang ada di DB
      const existing = await prisma.annualBudget.findUnique({
        where: { budget_id: id },
      });

      if (!existing) throw new Error('Budget tidak ditemukan');

      // 2. Tentukan target efisiensi (prioritas payload baru, kalau tidak ada pakai yang lama)
      // Pastikan di-parse ke float karena Decimal Prisma sering terbaca string
      const efficiencyTarget = parseFloat(
        (
          budget.efficiency_target_percentage ??
          existing.efficiency_target_percentage ??
          0
        ).toString(),
      );

      // 3. Paksa hitung ulang profile jika ada update alokasi
      if (budget.allocations?.upsert) {
        budget.allocations.upsert = budget.allocations.upsert.map((item) => {
          // Logika Update: Jika amount berubah, hitung ulang profile
          if (item.update?.allocated_amount) {
            item.update.monthly_distribution_profile = generateMonthlyProfile(
              Number(item.update.allocated_amount),
              efficiencyTarget,
            );
          }

          // Logika Create (jika admin tambah meteran baru di menu edit)
          if (item.create) {
            item.create.monthly_distribution_profile = generateMonthlyProfile(
              Number(item.create.allocated_amount),
              efficiencyTarget,
            );
          }

          return item;
        });
      }

      return await prisma.annualBudget.update({
        where: { budget_id: id },
        data: budget as any,
        include: { allocations: true },
      });
    } catch (error) {
      return handlePrismaError(error, 'Annual Budget Update');
    }
  },

  /**
   * Menampilkan Data (List atau Detail)
   */
  show: async (id?: number, query?: any) => {
    try {
      if (id) {
        return await prisma.annualBudget.findUnique({
          where: { budget_id: id },
          include: {
            allocations: { include: { meter: { select: { name: true, meter_code: true } } } },
            energy_type: true,
            creator: { select: { username: true } },
          },
        });
      }

      const page = Number(query?.page) || 1;
      const limit = Number(query?.limit) || 10;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        prisma.annualBudget.findMany({
          where: {
            AND: [
              query?.search ? { name: { contains: query.search, mode: 'insensitive' } } : {},
              query?.year ? { fiscal_year: Number(query.year) } : {},
            ],
          },
          skip,
          take: limit,
          orderBy: { fiscal_year: 'desc' },
          include: { energy_type: true, _count: { select: { allocations: true } } },
        }),
        prisma.annualBudget.count(),
      ]);

      return { data, meta: { total, page, limit, total_pages: Math.ceil(total / limit) } };
    } catch (error) {
      return handlePrismaError(error, 'Annual Budget');
    }
  },

  /**
   * Menghitung Realisasi & Sisa Budget
   */
  showRemaining: async (budgetId: number) => {
    try {
      const budget = await prisma.annualBudget.findUnique({
        where: { budget_id: budgetId },
        include: { allocations: true },
      });

      if (!budget) return null;

      // Hitung realisasi dari ringkasan harian (DailySummary)
      const realization = await prisma.dailySummary.aggregate({
        where: { meter_id: { in: budget.allocations.map((a) => a.meter_id) } },
        _sum: { total_cost: true },
      });

      const totalRealization = Number(realization._sum.total_cost) || 0;
      const remaining = Number(budget.total_amount) - totalRealization;

      return {
        ...budget,
        total_realization: totalRealization,
        remaining_budget: remaining,
      };
    } catch (error) {
      return handlePrismaError(error, 'Annual Budget Remaining');
    }
  },

  remove: async (id: number) => {
    try {
      return await prisma.annualBudget.delete({ where: { budget_id: id } });
    } catch (error) {
      return handlePrismaError(error, 'Annual Budget');
    }
  },
};
