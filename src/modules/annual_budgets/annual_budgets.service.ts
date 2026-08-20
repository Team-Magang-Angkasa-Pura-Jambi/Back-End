import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { Prisma } from '../../generated/prisma/index.js';
import { Error404 } from '../../utils/customError.js';
import { type CreateBudgetPayload, type UpdateBudgetPayload } from './annual_budgets.type.js';

export const budgetService = {
  store: async (payload: CreateBudgetPayload) => {
    try {
      const budget = await prisma.annualBudget.create({
        data: {
          name: payload.name,
          fiscal_year: Number(payload.fiscal_year),
          total_amount: payload.total_amount,
          efficiency_target_percentage: payload.efficiency_target_percentage,
          description: payload.description,
          energy_type_id: Number(payload.energy_type_id),
          created_by: payload.created_by ? Number(payload.created_by) : undefined,
        },
      });

      // Audit Log Create
      try {
        await prisma.auditLog.create({
          data: {
            action: 'CREATE',
            entity_table: 'AnnualBudget',
            entity_id: String(budget.budget_id),
            old_values: undefined,
            new_values: budget as any,
            user_id: payload.created_by ? Number(payload.created_by) : 1,
          },
        });
      } catch (logErr) {
        console.warn('[AuditLog] Gagal mencatat create AnnualBudget:', logErr);
      }

      return budget;
    } catch (error) {
      console.error('🔥 ERROR PRISMA STORE BUDGET:', error);
      return handlePrismaError(error, 'Annual Budget Store');
    }
  },

  patch: async (id: number, payload: UpdateBudgetPayload) => {
    try {
      const existingBudget = await prisma.annualBudget.findUnique({
        where: { budget_id: id },
      });

      if (!existingBudget) throw new Error404('Budget Tidak ditemukan');

      const updated = await prisma.annualBudget.update({
        where: { budget_id: id },
        data: {
          name: payload.name,
          fiscal_year: payload.fiscal_year !== undefined ? Number(payload.fiscal_year) : undefined,
          total_amount: payload.total_amount,
          efficiency_target_percentage: payload.efficiency_target_percentage,
          description: payload.description,
          energy_type_id:
            payload.energy_type_id !== undefined ? Number(payload.energy_type_id) : undefined,
          updated_by: payload.updated_by ? Number(payload.updated_by) : undefined,
        },
      });

      // Audit Log Update
      try {
        await prisma.auditLog.create({
          data: {
            action: 'UPDATE',
            entity_table: 'AnnualBudget',
            entity_id: String(id),
            old_values: existingBudget as any,
            new_values: updated as any,
            user_id: payload.updated_by ? Number(payload.updated_by) : 1,
          },
        });
      } catch (logErr) {
        console.warn('[AuditLog] Gagal mencatat update AnnualBudget:', logErr);
      }

      return updated;
    } catch (error) {
      console.error('🔥 ERROR PRISMA UPDATE BUDGET:', error);
      return handlePrismaError(error, 'Annual Budget Update');
    }
  },

  show: async (id?: number, query?: Record<string, unknown>) => {
    try {
      if (id) {
        return await prisma.annualBudget.findUnique({
          where: { budget_id: id },
          include: {
            energy_type: true,
            creator: { select: { username: true } },
            updater: { select: { username: true } },
          },
        });
      }

      const page = Number(query?.page) || 1;
      const limit = Number(query?.limit) || 10;
      const skip = (page - 1) * limit;

      const whereClause: Prisma.AnnualBudgetWhereInput = {
        AND: [
          query?.search ? { name: { contains: String(query.search), mode: 'insensitive' } } : {},
          query?.year ? { fiscal_year: Number(query.year) } : {},
        ],
      };

      const [data, total] = await Promise.all([
        prisma.annualBudget.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { fiscal_year: 'desc' },
          include: { energy_type: true },
        }),
        prisma.annualBudget.count({ where: whereClause }),
      ]);

      return { data, meta: { total, page, limit, total_pages: Math.ceil(total / limit) } };
    } catch (error) {
      return handlePrismaError(error, 'Annual Budget Show');
    }
  },

  showRemaining: async (budgetId: number) => {
    try {
      const budget = await prisma.annualBudget.findUnique({
        where: { budget_id: budgetId },
      });

      if (!budget) return null;

      const startDate = new Date(`${budget.fiscal_year}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${budget.fiscal_year}-12-31T23:59:59.999Z`);

      const realization = await prisma.dailySummary.aggregate({
        where: {
          meter: {
            energy_type_id: budget.energy_type_id,
          },
          summary_date: {
            gte: startDate,
            lte: endDate,
          },
        },
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
      console.error('🔥 ERROR PRISMA REMAINING BUDGET:', error);
      return handlePrismaError(error, 'Annual Budget Remaining');
    }
  },

  remove: async (id: number, userId?: number) => {
    try {
      const existing = await prisma.annualBudget.findUnique({ where: { budget_id: id } });
      const deleted = await prisma.annualBudget.delete({ where: { budget_id: id } });

      if (existing) {
        try {
          await prisma.auditLog.create({
            data: {
              action: 'DELETE',
              entity_table: 'AnnualBudget',
              entity_id: String(id),
              old_values: existing as any,
              new_values: undefined,
              user_id: userId ?? 1,
            },
          });
        } catch (logErr) {
          console.warn('[AuditLog] Gagal mencatat delete AnnualBudget:', logErr);
        }
      }

      return deleted;
    } catch (error) {
      return handlePrismaError(error, 'Annual Budget Delete');
    }
  },

  getTrackingData: async (year: number, energyTypeId: number) => {
    try {
      const budget = await prisma.annualBudget.findFirst({
        where: {
          fiscal_year: year,
          energy_type_id: energyTypeId,
        },
        include: {
          energy_type: true,
        },
      });

      if (!budget) {
        return null;
      }

      const initialBudget = Number(budget.total_amount) || 0;
      const monthlyBudget = initialBudget / 12;

      const monthlyRealization = await prisma.$queryRaw<
        Array<{
          month: number;
          total_actual_cost: number;
        }>
      >`
        SELECT 
          EXTRACT(MONTH FROM ds.summary_date)::integer AS month,
          COALESCE(SUM(ds.total_cost), 0)::float AS total_actual_cost
        FROM daily_summaries ds
        JOIN meters m ON ds.meter_id = m.meter_id
        WHERE 
          m.energy_type_id = ${energyTypeId}
          AND EXTRACT(YEAR FROM ds.summary_date) = ${year}
        GROUP BY EXTRACT(MONTH FROM ds.summary_date)
        ORDER BY month ASC;
      `;

      const monthlyDataMap = new Map<number, number>();
      monthlyRealization.forEach((row) => {
        monthlyDataMap.set(row.month, row.total_actual_cost);
      });

      const trackingMonths = [];
      let cumulativeBudget = 0;
      let cumulativeActual = 0;

      for (let month = 1; month <= 12; month++) {
        const actualCost = monthlyDataMap.get(month) || 0;
        cumulativeBudget += monthlyBudget;
        cumulativeActual += actualCost;

        const deviation = actualCost - monthlyBudget;
        const deviationPercentage = monthlyBudget > 0 ? (deviation / monthlyBudget) * 100 : 0;

        let status: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
        if (actualCost > monthlyBudget) {
          status = 'CRITICAL';
        } else if (actualCost > monthlyBudget * 0.85) {
          status = 'WARNING';
        }

        trackingMonths.push({
          month,
          budget_allocated: monthlyBudget,
          actual_consumption_cost: actualCost,
          cumulative_budget: cumulativeBudget,
          cumulative_actual: cumulativeActual,
          deviation_cost: deviation,
          deviation_percentage: Math.round(deviationPercentage * 100) / 100,
          status,
        });
      }

      return {
        fiscal_year: year,
        energy_type: budget.energy_type?.name,
        unit: budget.energy_type?.unit_standard,
        total_annual_budget: initialBudget,
        monthly_average_budget: monthlyBudget,
        efficiency_target_percentage: Number(budget.efficiency_target_percentage) || 0,
        monthly_tracking: trackingMonths,
      };
    } catch (error) {
      console.error('🔥 ERROR PRISMA GET TRACKING BUDGET:', error);
      return handlePrismaError(error, 'Annual Budget Tracking');
    }
  },
};
