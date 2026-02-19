import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type CreateBudgetPayload, type UpdateBudgetPayload } from './annual_budgets.type.js';

const generateDefaultProfile = (amount: number) => {
  const perMonth = amount / 12;
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
  months.forEach((m) => (profile[m] = Number(perMonth.toFixed(2))));
  return profile;
};
export const budgetService = {
  store: async (payload: CreateBudgetPayload) => {
    try {
      // Manipulasi payload sebelum masuk ke Prisma
      if (payload.budget.allocations?.create) {
        payload.budget.allocations.create = payload.budget.allocations.create.map((alloc) => ({
          ...alloc,
          // Jika monthly_distribution_profile tidak ada, buatkan otomatis
          monthly_distribution_profile:
            alloc.monthly_distribution_profile ??
            generateDefaultProfile(Number(alloc.allocated_amount)),
        }));
      }

      return await prisma.annualBudget.create({
        data: payload.budget,
        include: { allocations: true },
      });
    } catch (error) {
      return handlePrismaError(error, 'Annual Budget');
    }
  },

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
              query?.year ? { fiscal_year: query.year } : {},
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

  patch: async (id: number, payload: UpdateBudgetPayload) => {
    try {
      return await prisma.annualBudget.update({
        where: { budget_id: id },
        data: payload.budget,
        include: { allocations: true },
      });
    } catch (error) {
      return handlePrismaError(error, 'Annual Budget');
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
