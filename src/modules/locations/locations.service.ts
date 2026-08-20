import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';
import { type LocationsPayload, type UpdateLocationsPayload } from './locations.type.js';

export const locationsService = {
  store: async (payload: LocationsPayload) => {
    try {
      return await prisma.location.create({ data: payload });
    } catch (error) {
      return handlePrismaError(error, 'Location');
    }
  },

  show: async (id?: number, query?: { name?: string }) => {
    if (id) {
      return await prisma.location.findUnique({
        where: { location_id: id },
        include: {
          meters: {
            select: { meter_id: true, meter_code: true, name: true },
          },

          parent: {
            select: {
              location_id: true,
              name: true,
            },
          },

          children: {
            select: {
              location_id: true,
              name: true,
              _count: { select: { meters: true } },
            },
          },
        },
      });
    }

    const whereClause: Prisma.LocationWhereInput = {};

    if (query?.name) {
      whereClause.name = {
        contains: query.name,
        mode: 'insensitive',
      };
    }

    return await prisma.location.findMany({
      where: whereClause,
      include: {
        parent: { select: { name: true } },
        _count: { select: { meters: true, children: true } },
      },
      orderBy: { name: 'asc' },
    });
  },

  patch: async (id: number, payload: UpdateLocationsPayload) => {
    try {
      return await prisma.location.update({
        where: { location_id: id },
        data: payload,
      });
    } catch (error) {
      return handlePrismaError(error, 'Location');
    }
  },

  remove: async (id: number) => {
    try {
      return await prisma.location.delete({
        where: { location_id: id },
      });
    } catch (error) {
      return handlePrismaError(error, 'Location');
    }
  },
};
