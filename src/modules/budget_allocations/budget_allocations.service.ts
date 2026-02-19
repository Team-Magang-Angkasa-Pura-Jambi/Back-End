import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import {
  type CreateAllocationPayload,
  type UpdateAllocationPayload,
} from './budget_allocations.type.js';

export const allocationService = {
  store: async (payload: CreateAllocationPayload) => {
    try {
      return await prisma.budgetAllocation.create({
        data: payload.allocation,
        include: { meter: { select: { name: true } }, budget: { select: { name: true } } },
      });
    } catch (error) {
      return handlePrismaError(error, 'Budget Allocation');
    }
  },

  show: async (id?: number, query?: any) => {
    try {
      if (id) {
        return await prisma.budgetAllocation.findUnique({
          where: { allocation_id: id },
          include: { meter: true, budget: true },
        });
      }
      return await prisma.budgetAllocation.findMany({
        where: {
          budget_id: query?.budget_id,
          meter_id: query?.meter_id,
        },
        include: { meter: { select: { name: true, meter_code: true } } },
        orderBy: { created_at: 'desc' },
      });
    } catch (error) {
      return handlePrismaError(error, 'Budget Allocation');
    }
  },

  patch: async (id: number, payload: UpdateAllocationPayload) => {
    try {
      return await prisma.budgetAllocation.update({
        where: { allocation_id: id },
        data: payload.allocation,
      });
    } catch (error) {
      return handlePrismaError(error, 'Budget Allocation');
    }
  },

  remove: async (id: number) => {
    try {
      return await prisma.budgetAllocation.delete({ where: { allocation_id: id } });
    } catch (error) {
      return handlePrismaError(error, 'Budget Allocation');
    }
  },
};
