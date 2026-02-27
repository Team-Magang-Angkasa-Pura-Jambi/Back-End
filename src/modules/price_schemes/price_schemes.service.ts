import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
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
        const scheme = await prisma.priceScheme.findUnique({
          where: { scheme_id: id },
          include: {
            rates: {
              include: {
                reading_type: {
                  include: {
                    meter_configs: {
                      select: {
                        meter: { select: { meter_id: true, name: true, meter_code: true } },
                      },
                    },
                  },
                },
              },
            },
            creator: { select: { full_name: true } },
            updater: { select: { full_name: true } },
          },
        });

        if (!scheme) return null;

        // MAPPING: Ambil semua meter unik dari semua rates
        const allMeters = scheme.rates.flatMap((rate) =>
          rate.reading_type.meter_configs.map((mc) => ({
            id: mc.meter.meter_id,
            name: mc.meter.name,
            code: mc.meter.meter_code,
          })),
        );

        // Hilangkan duplikasi jika satu meter punya lebih dari satu reading type
        const uniqueMeters = Array.from(new Map(allMeters.map((m) => [m.id, m])).values());

        return {
          id: scheme.scheme_id,
          name: scheme.name,
          description: scheme.description,
          effective_date: scheme.effective_date,
          is_active: scheme.is_active,
          created_by: scheme.creator?.full_name,
          updated_by: scheme.updater?.full_name,
          // Data yang sudah diratakan (flattened)
          connected_meters: uniqueMeters,
          rates: scheme.rates.map((r) => ({
            rate_id: r.rate_id,
            value: r.rate_value,
            label: r.reading_type.type_name,
            unit: r.reading_type.unit,
          })),
        };
      }

      // --- LOGIC UNTUK LIST (findMany) ---
      const page = Number(query?.page) || 1;
      const limit = Number(query?.limit) || 10;
      const skip = (page - 1) * limit;

      const [rawItems, total] = await Promise.all([
        prisma.priceScheme.findMany({
          where: {
            name: query?.search ? { contains: query.search, mode: 'insensitive' } : undefined,
            is_active: query?.is_active,
          },
          skip,
          take: limit,
          orderBy: { effective_date: 'desc' },
          include: {
            creator: { select: { full_name: true } },
            rates: {
              include: {
                reading_type: {
                  include: {
                    meter_configs: { select: { meter: { select: { name: true } } } },
                  },
                },
              },
            },
          },
        }),
        prisma.priceScheme.count({
          /* where sama seperti di atas */
        }),
      ]);

      const formattedData = rawItems.map((item) => {
        // Ambil ringkasan meter untuk tampilan tabel
        const meters = item.rates.flatMap((r) =>
          r.reading_type.meter_configs.map((mc) => mc.meter.name),
        );
        const uniqueMeterNames = [...new Set(meters)];

        return {
          id: item.scheme_id,
          name: item.name,
          effective_date: item.effective_date,
          is_active: item.is_active,
          total_meters: uniqueMeterNames.length,
          meter_summary: uniqueMeterNames.slice(0, 3), // Ambil 3 contoh nama meter
          created_by: item.creator?.full_name,
          tariffs: item.rates.map((r) => ({
            rate_id: r.rate_id,
            reading_type_id: r.reading_type.reading_type_id,
            type_name: r.reading_type.type_name,
            label: r.reading_type.type_name,
            value: r.rate_value,
            unit: r.reading_type.unit,
          })),
        };
      });

      return {
        data: formattedData,
        meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
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
