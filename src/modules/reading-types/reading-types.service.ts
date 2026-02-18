// Generated for Sentinel Project

import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type readingTypePayload, type UpdateReadingTypePayload } from './reading-types.type.js';

export const readingTypesSerices = {
  create: async (payload: readingTypePayload) => {
    return await prisma.readingType.create({
      data: payload,
    });
  },

  show: async (id?: number, query?: { type_name: string }) => {
    if (id) {
      return await prisma.readingType.findUnique({
        where: { reading_type_id: id },
        select: {
          reading_type_id: true,
          type_name: true,
          energy_type: {
            select: {
              energy_type_id: true,
              name: true,
            },
          },
          scheme_rates: {
            select: {
              rate_id: true,
              scheme: true,
            },
          },
          meter_configs: {
            select: {
              config_id: true,
              meter: true,
            },
          },
        },
      });
    } else {
      return await prisma.readingType.findMany({
        where: query,
      });
    }
  },
  patch: async (id: number, payload: UpdateReadingTypePayload) => {
    try {
      return await prisma.readingType.update({
        where: { reading_type_id: id },
        data: payload,
      });
    } catch (error) {
      return handlePrismaError(error, 'Reading Type');
    }
  },
  remove: async (id: number) => {
    try {
      return await prisma.readingType.delete({
        where: { reading_type_id: id },
      });
    } catch (error) {
      return handlePrismaError(error, 'Reading Type');
    }
  },
};
