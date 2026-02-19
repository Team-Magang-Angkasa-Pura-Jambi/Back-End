import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';
import {
  type CreatePriceSchemePayload,
  type UpdatePriceSchemePayload,
  type PriceSchemeQuery,
} from './price_schemes.type.js';

export const priceSchemeService = {
  store: async (payload: CreatePriceSchemePayload) => {
    try {
      return await prisma.priceScheme.create({
        data: payload.scheme,
        include: {
          rates: {
            include: { reading_type: { select: { type_name: true, unit: true } } },
          },
        },
      });
    } catch (error) {
      return handlePrismaError(error, 'Price Scheme');
    }
  },

  show: async (id?: number, query?: PriceSchemeQuery) => {
    try {
      if (id) {
        return await prisma.priceScheme.findUnique({
          where: { scheme_id: id },
          include: {
            rates: {
              include: { reading_type: true },
            },
            creator: { select: { username: true } },
            updater: { select: { username: true } },
            _count: { select: { meters: true } },
          },
        });
      }

      const page = Number(query?.page) || 1;
      const limit = Number(query?.limit) || 10;
      const skip = (page - 1) * limit;

      const where: Prisma.PriceSchemeWhereInput = {};
      if (query?.search) {
        where.name = { contains: query.search, mode: 'insensitive' };
      }
      if (query?.is_active !== undefined) {
        where.is_active = query.is_active;
      }

      const [data, total] = await Promise.all([
        prisma.priceScheme.findMany({
          where,
          skip,
          take: limit,
          orderBy: { effective_date: 'desc' },
          include: {
            _count: { select: { meters: true } },
            rates: { take: 1 },
          },
        }),
        prisma.priceScheme.count({ where }),
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
      return handlePrismaError(error, 'Price Scheme');
    }
  },

  patch: async (id: number, payload: UpdatePriceSchemePayload) => {
    try {
      const { rates, ...schemeData } = payload.scheme as any;

      return await prisma.priceScheme.update({
        where: { scheme_id: id },
        data: {
          ...schemeData,

          rates: rates
            ? {
                deleteMany: {},
                create: rates.create,
              }
            : undefined,
        },
        include: { rates: true },
      });
    } catch (error) {
      return handlePrismaError(error, 'Price Scheme');
    }
  },

  remove: async (id: number) => {
    try {
      return await prisma.priceScheme.delete({
        where: { scheme_id: id },
      });
    } catch (error) {
      return handlePrismaError(error, 'Price Scheme');
    }
  },
};
