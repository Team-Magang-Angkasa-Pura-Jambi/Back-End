import prisma from '../../configs/db.js';
import { handlePrismaError } from '../../common/utils/prismaError.js';
import { PaxPayload, PaxQuery } from './pax.types.js';
import { Prisma } from '../../generated/prisma/index.js';

export const paxService = {
  store: async (data: PaxPayload) => {
    try {
      return await prisma.paxData.create({
        data: {
          date: new Date(data.date),
          pax_count: data.pax_count,
          location_id: data.location_id,
          session_id: data.session_id,
        },
      });
    } catch (error) {
      return handlePrismaError(error, 'PaxData');
    }
  },

  show: async (query: PaxQuery) => {
    const { start_date, end_date, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PaxDataWhereInput = {};

    // Filter Tanggal Fleksibel (Bisa awal saja, akhir saja, atau rentang)
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = start_date;
      if (end_date) where.date.lte = end_date;
    }

    // Eksekusi Query secara Paralel
    const [data, total] = await Promise.all([
      prisma.paxData.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      prisma.paxData.count({ where }),
    ]);

    return {
      pax_data: data,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  },

  getById: async (pax_id: number) => {
    return prisma.paxData.findUnique({
      where: { pax_id },
      include: {
        location: true,
        session: true,
      },
    });
  },

  update: async (pax_id: number, data: Partial<PaxPayload>) => {
    try {
      const updateData: any = { ...data };
      if (data.date) updateData.date = new Date(data.date);

      return await prisma.paxData.update({
        where: { pax_id },
        data: updateData,
      });
    } catch (error) {
      return handlePrismaError(error, 'PaxData');
    }
  },

  remove: async (pax_id: number) => {
    try {
      return await prisma.paxData.delete({
        where: { pax_id },
      });
    } catch (error) {
      return handlePrismaError(error, 'PaxData');
    }
  },
};
