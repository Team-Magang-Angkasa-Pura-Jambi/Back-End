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

        if (payload.reading_config && payload.reading_config.length > 0) {
          createData.reading_configs = {
            createMany: {
              data: payload.reading_config,
            },
          };
        }

        const newMeter = await tx.meter.create({
          data: createData,
          include: {
            energy_type: { select: { name: true, unit_standard: true } },
            tank_profile: true,
            reading_configs: true,
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
      energy_type_id?: number;
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
              select: {
                reading_type: { select: { type_name: true, unit: true, reading_type_id: true } },
                alarm_max_threshold: true,
                alarm_min_threshold: true,
                is_active: true,
                config_id: true,
              },
            },
            budget_allocations: {
              include: {
                budget: true,
              },
            },
            calculation_template: {
              select: {
                name: true,
                creator: {
                  select: {
                    full_name: true,
                  },
                },
                definitions: { select: { name: true, formula_items: true } },
              },
            },
            efficiency_targets: true,
            price_scheme: {
              include: {
                rates: true,
              },
            },
            updater: {
              select: {
                full_name: true,
              },
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

      if (query?.energy_type_id) {
        where.energy_type_id = query.energy_type_id;
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
      return await prisma.$transaction(async (tx) => {
        const { meter, meter_profile, reading_config } = payload;

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

        if (reading_config) {
          const incomingReadingTypeIds = reading_config.map((c) => c.reading_type_id);

          await tx.meterReadingConfig.deleteMany({
            where: {
              meter_id: id,
              reading_type_id: {
                notIn: incomingReadingTypeIds,
              },
            },
          });

          if (reading_config.length > 0) {
            for (const config of reading_config) {
              await tx.meterReadingConfig.upsert({
                where: {
                  meter_id_reading_type_id: {
                    meter_id: id,
                    reading_type_id: config.reading_type_id,
                  },
                },
                create: {
                  meter_id: id,
                  reading_type_id: config.reading_type_id,
                  is_active: config.is_active,
                  alarm_min_threshold: config.alarm_min_threshold,
                  alarm_max_threshold: config.alarm_max_threshold,
                },
                update: {
                  is_active: config.is_active,
                  alarm_min_threshold: config.alarm_min_threshold,
                  alarm_max_threshold: config.alarm_max_threshold,
                },
              });
            }
          }
        }

        const updatedMeter = await tx.meter.update({
          where: { meter_id: id },
          data: updateData,
          include: {
            tank_profile: true,
            energy_type: { select: { name: true, unit_standard: true } },
            reading_configs: {
              include: { reading_type: true },
            },
          },
        });

        return updatedMeter;
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

  getAvailableAttributes: async (id: number) => {
    try {
      const targetMeter = await prisma.meter.findUnique({
        where: { meter_id: id },
        include: {
          reading_configs: {
            where: { is_active: true },
            include: { reading_type: true },
          },
          location: {
            include: {
              meters: {
                where: {
                  NOT: { meter_id: id },
                  status: 'ACTIVE',
                },
                include: {
                  reading_configs: {
                    where: { is_active: true },
                    include: { reading_type: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!targetMeter) throw new Error('Meter not found');

      const attributes = [];

      attributes.push({
        label: `Faktor Kali (${targetMeter.meter_code})`,
        type: 'spec',
        specField: 'multiplier',
        meterId: targetMeter.meter_id,
      });

      targetMeter.reading_configs.forEach((config) => {
        attributes.push({
          label: config.reading_type.type_name,
          type: 'reading',
          readingTypeId: config.reading_type_id,
          meterId: targetMeter.meter_id,
          timeShift: 0,
        });
      });

      if (targetMeter.location?.meters) {
        targetMeter.location.meters.forEach((otherMeter) => {
          attributes.push({
            label: `Faktor Kali (${otherMeter.meter_code})`,
            type: 'spec',
            specField: 'multiplier',
            meterId: otherMeter.meter_id,
          });

          otherMeter.reading_configs.forEach((config) => {
            attributes.push({
              label: `${config.reading_type.type_name} (${otherMeter.meter_code})`,
              type: 'reading',
              readingTypeId: config.reading_type_id,
              meterId: otherMeter.meter_id,
              timeShift: 0,
            });
          });
        });
      }

      return attributes;
    } catch (error) {
      return handlePrismaError(error, 'Meter Attributes');
    }
  },
};
