// Generated for Sentinel Project

import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';
import { type EfficiencyTargetPayload } from './efficiency_targets.type.js';

export const efficiencyTargetsService = {
  show: async (id?: number, query?: { priode_start: Date; priode_end: Date; kpi_Name: string }) => {
    if (id) {
      return await prisma.efficiencyTarget.findUnique({
        where: {
          target_id: id,
        },
        include: { meter: { select: { meter_id: true, meter_code: true, name: true } } },
      });
    }

    const where: Prisma.EfficiencyTargetWhereInput = {};

    if (query?.priode_start) {
      where.period_start = { gte: query.priode_start };
    }

    if (query?.priode_end) {
      where.period_end = { lte: query.priode_end };
    }

    if (query?.kpi_Name) {
      where.kpi_name = { contains: query.kpi_Name };
    }

    return await prisma.efficiencyTarget.findMany({ where });
  },

  store: async (data: EfficiencyTargetPayload) => {
    try {
      return await prisma.efficiencyTarget.create({ data });
    } catch (error) {
      return handlePrismaError(error, 'Efficiency Target');
    }
  },

  patch: async (id: number, data: EfficiencyTargetPayload) => {
    try {
      return await prisma.efficiencyTarget.update({
        where: { target_id: id },
        data,
      });
    } catch (error) {
      return handlePrismaError(error, 'Efficiency Target');
    }
  },

  remove: async (id: number) => {
    try {
      return await prisma.efficiencyTarget.delete({
        where: { target_id: id },
      });
    } catch (error) {
      return handlePrismaError(error, 'Efficiency Target');
    }
  },
};
