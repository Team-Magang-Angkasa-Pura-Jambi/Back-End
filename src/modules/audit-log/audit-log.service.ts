import prisma from '../../configs/db.js';
import { Error405 } from '../../utils/customError.js';

export const auditLogService = {
  show: async (query?: {
    page?: number;
    limit?: number;
    action?: string;
    entity_table?: string;
  }) => {
    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query?.action) where.action = query.action;
    if (query?.entity_table) where.entity_table = query.entity_table;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          created_at: 'desc',
        },
        include: {
          user: {
            select: {
              full_name: true,
              username: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
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
  },

  store: async (data: any) => {
    return await prisma.auditLog.create({
      data,
    });
  },

  patch: () => {
    throw new Error405('Audit logs cannot be modified.');
  },

  remove: () => {
    throw new Error405('Audit logs cannot be deleted.');
  },
};
