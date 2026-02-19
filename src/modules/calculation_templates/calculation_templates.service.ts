import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';
import {
  type CreateTemplatePayload,
  type UpdateTemplatePayload,
} from './calculation_templates.type.js';

export const templateService = {
  /**
   * Membuat template baru sekaligus dengan definisi formulanya (Nested Write)
   */
  store: async (payload: CreateTemplatePayload) => {
    try {
      return await prisma.calculationTemplate.create({
        data: payload.template,
        include: {
          definitions: true,
          creator: { select: { username: true } },
        },
      });
    } catch (error) {
      return handlePrismaError(error, 'Calculation Template');
    }
  },

  /**
   * Mengambil satu detail template atau daftar banyak template
   */
  show: async (
    id?: string,
    query?: {
      page?: number;
      limit?: number;
      search?: string;
    },
  ) => {
    try {
      if (id) {
        return await prisma.calculationTemplate.findUnique({
          where: { template_id: id },
          include: {
            definitions: true,
            meters: {
              select: { meter_id: true, name: true, meter_code: true },
            },
            creator: { select: { username: true } },
            updater: { select: { username: true } },
          },
        });
      }

      const page = Number(query?.page) || 1;
      const limit = Number(query?.limit) || 10;
      const skip = (page - 1) * limit;

      const where: Prisma.CalculationTemplateWhereInput = query?.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {};

      const [data, total] = await Promise.all([
        prisma.calculationTemplate.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
          include: {
            _count: { select: { meters: true } },

            definitions: true,
          },
        }),
        prisma.calculationTemplate.count({ where }),
      ]);

      return {
        data,
        meta: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      return handlePrismaError(error, 'Calculation Template');
    }
  },

  patch: async (id: string, payload: UpdateTemplatePayload) => {
    try {
      return await prisma.calculationTemplate.update({
        where: { template_id: id },
        data: payload.template,
        include: {
          definitions: true,
        },
      });
    } catch (error) {
      return handlePrismaError(error, 'Calculation Template');
    }
  },

  remove: async (id: string) => {
    try {
      return await prisma.calculationTemplate.delete({
        where: { template_id: id },
      });
    } catch (error) {
      return handlePrismaError(error, 'Calculation Template');
    }
  },
};
