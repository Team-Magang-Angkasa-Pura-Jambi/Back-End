import prisma from '../../configs/db.js';
import { handlePrismaError } from '../../common/utils/prismaError.js';
import { DailySummaryQuery } from './daily_summaries.type.js';

export const dailySummaryService = {
  show: async (query: DailySummaryQuery) => {
    try {
      const { meter_id, from_date, to_date, page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (meter_id) where.meter_id = meter_id;

      if (from_date || to_date) {
        where.summary_date = {
          gte: from_date ? new Date(from_date) : undefined,
          lte: to_date ? new Date(to_date) : undefined,
        };
      }

      const [data, total] = await Promise.all([
        prisma.dailySummary.findMany({
          where,
          skip,
          take: limit,
          orderBy: { summary_date: 'desc' },
          include: {
            summary_details: true,
            meter: { select: { name: true, meter_code: true } },
          },
        }),
        prisma.dailySummary.count({ where }),
      ]);

      return {
        data,
        meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
      };
    } catch (error) {
      return handlePrismaError(error, 'Daily Summary');
    }
  },
};
