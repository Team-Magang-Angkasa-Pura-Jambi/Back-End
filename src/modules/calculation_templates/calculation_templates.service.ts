import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';
import {
  type CreateTemplatePayload,
  type UpdateTemplatePayload,
} from './calculation_templates.type.js';

export const templateService = {
  store: async (payload: CreateTemplatePayload) => {
    try {
      const { definitions, ...templateData } = payload.template;

      return await prisma.calculationTemplate.create({
        data: {
          ...templateData,
          definitions: {
            create: (definitions as any[]).map((def: any) => ({
              name: def.name,
              is_main: def.is_main ?? false,
              formula_items: def.formula_items,
            })),
          },
        },
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
   * Mengambil detail atau daftar template
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
            definitions: true,
            _count: { select: { meters: true } },
            creator: { select: { username: true } },
            updater: { select: { username: true } },
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

  /**
   * Update Template
   */
  patch: async (id: string, payload: UpdateTemplatePayload) => {
    try {
      const { definitions, ...templateData } = payload.template;

      return await prisma.calculationTemplate.update({
        where: { template_id: id },
        data: {
          ...templateData,
          ...(definitions && {
            definitions: {
              deleteMany: {},
              create: (definitions as any[]).map((def: any) => ({
                name: def.name,
                is_main: def.is_main ?? false,
                formula_items: def.formula_items,
              })),
            },
          }),
        },
        include: {
          definitions: true,
        },
      });
    } catch (error) {
      return handlePrismaError(error, 'Calculation Template');
    }
  },

  /**
   * Hapus Template
   */
  remove: async (id: string) => {
    try {
      return await prisma.calculationTemplate.delete({
        where: { template_id: id },
      });
    } catch (error) {
      return handlePrismaError(error, 'Calculation Template');
    }
  },

  listAvailableVariables: async () => {
    try {
      // 1. Ambil semua jenis bacaan yang terdaftar (WBP, LWBP, Flow Rate, Tinggi Cairan, dll)
      const readingTypes = await prisma.readingType.findMany({
        select: {
          reading_type_id: true,
          type_name: true,
          unit: true,
          energy_type: { select: { name: true } },
        },
        orderBy: { reading_type_id: 'asc' },
      });

      // 2. Definisikan mapping waktu (Time Shift) yang tersedia
      const timeOptions = [
        { label: 'Hari Ini / Stand Terkini (H-0)', value: 0 },
        { label: 'Kemarin / Stand H-1', value: -1 },
        { label: '2 Hari Lalu / Stand H-2', value: -2 },
      ];

      // 3. Ambil field spesifikasi dari konfigurasi Meter & Tangki (Spec)
      const specFields = [
        { label: 'Faktor Pengali (Multiplier)', value: 'multiplier', category: 'Meter' },
        { label: 'Batas Putaran Angka (Rollover Limit)', value: 'rollover_limit', category: 'Meter' },
        { label: 'Kapasitas Tangki (Liter)', value: 'capacity_liters', category: 'TankProfile' },
        { label: 'Tinggi Maksimum Tangki (cm)', value: 'height_max_cm', category: 'TankProfile' },
        { label: 'Diameter Tangki (cm)', value: 'diameter_cm', category: 'TankProfile' },
        { label: 'Panjang Tangki (cm)', value: 'length_cm', category: 'TankProfile' },
        { label: 'Lebar Tangki (cm)', value: 'width_cm', category: 'TankProfile' },
      ];

      // 4. Ambil daftar meteran yang tersedia
      const meters = await prisma.meter.findMany({
        select: {
          meter_id: true,
          meter_code: true,
          name: true,
          category: true,
        },
        orderBy: { meter_code: 'asc' },
      });

      return {
        readings: readingTypes.map((rt) => ({
          id: rt.reading_type_id,
          name: `${rt.type_name} (${rt.energy_type.name})`,
          unit: rt.unit,
        })),
        timeContext: timeOptions,
        specs: specFields,
        meters: meters.map((m) => ({
          id: m.meter_id,
          code: m.meter_code,
          name: m.name,
          category: m.category,
        })),
      };
    } catch (error) {
      return handlePrismaError(error, 'Variable List');
    }
  },
};
