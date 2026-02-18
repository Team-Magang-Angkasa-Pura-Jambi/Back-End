import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type EnergyPayload } from './energies.type.js';

export const energiesService = {
  store: async (payload: EnergyPayload) => {
    return await prisma.energyType.create({
      data: payload,
      select: {
        energy_type_id: true,
        name: true,
      },
    });
  },
  show: async (id?: number) => {
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
            reading_types: {
              select: {
                reading_type_id: true,
                type_name: true,
              },
            },
            annual_budgets: { select: { allocations: true } },
          },
        },
      });
    } else {
      return await prisma.energyType.findMany({
        select: {
          energy_type_id: true,
          name: true,
        },
      });
    }
  },
  patch: async (id: number, payload: EnergyPayload) => {
    try {
      return await prisma.energyType.update({
        where: { energy_type_id: id },
        data: payload,
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
