import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';
import { type EnergyPayload } from './energies.type.js';

export const energiesService = {
  store: async (payload: EnergyPayload) => {
    return await prisma.energyType.create({
      data: {
        name: payload.name,
        unit_standard: payload.unit_standard,

        reading_types: {
          create: payload.reading_types?.map((rt) => ({
            type_name: rt.type_name,
            unit: rt.unit,
          })),
        },
      },
      select: {
        energy_type_id: true,
        name: true,
        reading_types: true,
      },
    });
  },
  showWithReadingType: async () => {
    return await prisma.energyType.findMany({
      include: {
        reading_types: {
          include: {
            meter_configs: { select: { meter: { select: { meter_code: true, name: true } } } },
            scheme_rates: { select: { rate_value: true } },
          },
        },
      },
    });
  },
  show: async (id?: number, query?: { name?: string }) => {
    if (id) {
      return await prisma.energyType.findUnique({
        where: { energy_type_id: id },
        select: {
          energy_type_id: true,
          name: true,
          unit_standard: true,
          meters: {
            select: {
              meter_id: true,
              name: true,
            },
          },
          reading_types: {
            select: {
              reading_type_id: true,
              type_name: true,
            },
          },
          annual_budgets: { select: { allocations: true } },
        },
      });
    }
    const where: Prisma.EnergyTypeWhereInput = {};
    if (query?.name) {
      where.name = { contains: query.name };
    }

    return await prisma.energyType.findMany();
  },
  patch: async (id: number, payload: EnergyPayload) => {
    try {
      const { reading_types, ...energyData } = payload;

      return await prisma.$transaction(async (tx) => {
        const incomingIds =
          reading_types?.map((rt) => rt.reading_type_id).filter((id): id is number => !!id) ?? [];

        if (reading_types) {
          await tx.readingType.deleteMany({
            where: {
              energy_type_id: id,
              reading_type_id: { notIn: incomingIds },
            },
          });

          for (const rt of reading_types) {
            await tx.readingType.upsert({
              where: { reading_type_id: rt.reading_type_id ?? 0 },
              update: {
                type_name: rt.type_name,
                unit: rt.unit,
              },
              create: {
                type_name: rt.type_name,
                unit: rt.unit,
                energy_type_id: id,
              },
            });
          }
        }

        return await tx.energyType.update({
          where: { energy_type_id: id },
          data: energyData,
          include: {
            reading_types: {
              orderBy: { reading_type_id: 'asc' },
            },
          },
        });
      });
    } catch (error) {
      return handlePrismaError(error, 'Energi');
    }
  },
  remove: async (id: number) => {
    try {
      return await prisma.energyType.delete({
        where: { energy_type_id: id },
      });
    } catch (error) {
      return handlePrismaError(error, 'Energi');
    }
  },
};
