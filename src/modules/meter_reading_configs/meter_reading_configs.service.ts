import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';
import { type ConfigPayload, type UpdateConfigPayload } from './meter_reading_configs.type.js';

export const meterConfigsService = {
  store: async (payload: ConfigPayload) => {
    try {
      return await prisma.meterReadingConfig.create({
        data: payload.config,
        include: {
          meter: { select: { name: true, meter_code: true } },
          reading_type: { select: { type_name: true, unit: true } },
        },
      });
    } catch (error) {
      return handlePrismaError(error as Error, 'Meter Reading Config');
    }
  },

  show: async (
    id?: number,
    query?: {
      page?: number;
      limit?: number;
      meter_id?: number;
      reading_type_id?: number;
      is_active?: boolean;
    },
  ) => {
    try {
      if (id) {
        return await prisma.meterReadingConfig.findUnique({
          where: { config_id: id },
          include: {
            meter: { select: { name: true, meter_code: true } },
            reading_type: true,
          },
        });
      }

      const page = Number(query?.page) || 1;
      const limit = Number(query?.limit) || 10;
      const skip = (page - 1) * limit;

      const where: Prisma.MeterReadingConfigWhereInput = {};

      if (query?.meter_id) where.meter_id = query.meter_id;
      if (query?.reading_type_id) where.reading_type_id = query.reading_type_id;
      if (query?.is_active !== undefined) where.is_active = query.is_active;

      const [data, total] = await Promise.all([
        prisma.meterReadingConfig.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
          include: {
            meter: { select: { name: true, meter_code: true } },
            reading_type: { select: { type_name: true, unit: true } },
          },
        }),
        prisma.meterReadingConfig.count({ where }),
      ]);

      return {
        config: data, // <--- Namanya 'data'
        meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
      };
    } catch (error) {
      return handlePrismaError(error as Error, 'Meter Reading Config');
    }
  },

  patch: async (id: number, payload: UpdateConfigPayload) => {
    try {
      return await prisma.meterReadingConfig.update({
        where: { config_id: id },
        data: payload.config,
      });
    } catch (error) {
      return handlePrismaError(error as Error, 'Meter Reading Config');
    }
  },

  remove: async (id: number) => {
    try {
      return await prisma.meterReadingConfig.delete({
        where: { config_id: id },
      });
    } catch (error) {
      return handlePrismaError(error as Error, 'Meter Reading Config');
    }
  },
};
