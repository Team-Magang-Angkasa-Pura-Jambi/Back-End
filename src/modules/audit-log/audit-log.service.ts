import prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';
import { Error405 } from '../../utils/customError.js';

export const auditLogService = {
  show: async (query?: {
    page?: number;
    limit?: number;
    action?: string;
    entity_table?: string;
    start_date?: string;
    end_date?: string;
    user_id?: number;
  }) => {
    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;
    const skip = (page - 1) * limit;

    let entityTableFilter: any = undefined;
    if (query?.entity_table) {
      if (query.entity_table.includes(',')) {
        const tables = query.entity_table.split(',').map((t) => t.trim());
        entityTableFilter = { in: tables, mode: 'insensitive' };
      } else {
        entityTableFilter = { equals: query.entity_table.trim(), mode: 'insensitive' };
      }
    }

    const where: Prisma.AuditLogWhereInput = {
      ...(query?.action && { action: { equals: query.action.trim(), mode: 'insensitive' } }),
      ...(entityTableFilter && { entity_table: entityTableFilter }),
      ...(query?.user_id && !isNaN(Number(query.user_id)) && { user_id: Number(query.user_id) }),
    };

    const dateFilter: any = {};

    if (query?.start_date) {
      dateFilter.gte = new Date(new Date(query.start_date).setHours(0, 0, 0, 0));
    }

    if (query?.end_date) {
      dateFilter.lte = new Date(new Date(query.end_date).setHours(23, 59, 59, 999));
    }

    if (Object.keys(dateFilter).length > 0) {
      where.created_at = dateFilter;
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
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
