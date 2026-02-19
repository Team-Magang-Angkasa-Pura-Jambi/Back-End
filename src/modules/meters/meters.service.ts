import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';
import { type UpdateMetersPayload, type MetersPayload } from './meters.type.js';

export const metersService = {
  store: async (payload: MetersPayload) => {
    try {
      return await prisma.$transaction(async (tx) => {
        const energyType = await tx.energyType.findUnique({
          where: { energy_type_id: Number(payload.meter.energy_type_id) },
        });

        if (!energyType) throw new Error('Energy Type not found');

        const createData: Prisma.MeterUncheckedCreateInput = {
          ...payload.meter,
        };

        if (energyType.name === 'Fuel' && payload.meter_profile) {
          createData.tank_profile = {
            create: payload.meter_profile,
          };
        }

        const newMeter = await tx.meter.create({
          data: createData,
          include: {
            energy_type: { select: { name: true, unit_standard: true } },
            tank_profile: true,
            location: { select: { name: true } },
            tenant: { select: { name: true } },
          },
        });

        return newMeter;
      });
    } catch (error) {
      return handlePrismaError(error, 'Meter');
    }
  },

  show: async (
    id?: number,
    query?: {
      page?: number;
      limit?: number;
      search?: string;
      energy_type?: string;
      location_id?: number;
      tenant_id?: number;
      status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
    },
  ) => {
    try {
      if (id) {
        return await prisma.meter.findUnique({
          where: { meter_id: id },
          include: {
            tank_profile: true,
            energy_type: true,
            location: true,
            tenant: true,
            reading_configs: {
              include: { reading_type: true },
            },
          },
        });
      }

      const page = Number(query?.page) || 1;
      const limit = Number(query?.limit) || 10;
      const skip = (page - 1) * limit;

      const where: Prisma.MeterWhereInput = {};

      if (query?.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { meter_code: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      if (query?.energy_type) {
        where.energy_type = {
          name: { equals: query.energy_type, mode: 'insensitive' },
        };
      }
      if (query?.location_id) where.location_id = Number(query.location_id);
      if (query?.tenant_id) where.tenant_id = Number(query.tenant_id);
      if (query?.status) where.status = query.status;

      const [data, total] = await Promise.all([
        prisma.meter.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
          include: {
            energy_type: { select: { name: true, unit_standard: true } },
            location: { select: { name: true } },
            tenant: { select: { name: true } },
            tank_profile: true,
          },
        }),
        prisma.meter.count({ where }),
      ]);

      return {
        meter: data,
        meta: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      return handlePrismaError(error, 'Meter');
    }
  },

  patch: async (id: number, payload: UpdateMetersPayload) => {
    try {
      const { meter, meter_profile } = payload;

      const updateData: Prisma.MeterUncheckedUpdateInput = {
        ...meter,
      };

      if (meter_profile) {
        updateData.tank_profile = {
          upsert: {
            create: meter_profile as Prisma.TankProfileUncheckedCreateInput,
            update: meter_profile,
          },
        };
      }

      return await prisma.meter.update({
        where: { meter_id: id },
        data: updateData,
        include: {
          tank_profile: true,
          energy_type: true,
        },
      });
    } catch (error) {
      return handlePrismaError(error, 'Meter');
    }
  },

  remove: async (id: number) => {
    try {
      return await prisma.meter.delete({
        where: { meter_id: id },
      });
    } catch (error) {
      return handlePrismaError(error, 'Meter');
    }
  },
};
