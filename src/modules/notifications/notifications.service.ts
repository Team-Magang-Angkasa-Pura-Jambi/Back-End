import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { Prisma } from '../../generated/prisma/index.js';
import { type NotificationsPayload } from './notifications.type.js';

export const notificationsService = {
  store: async (data: NotificationsPayload) => {
    return prisma.notification.create({
      data: {
        user_id: data.user_id!,
        category: data.category,
        severity: data.severity,
        title: data.title,
        message: data.message,
        reference_table: data.reference_table,
        reference_id: data.reference_id,
        is_read: false,
      },
    });
  },

  show: async (user_id: number, query: { page?: number; limit?: number; is_read?: string }) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { user_id };
    if (query.is_read !== undefined) {
      where.is_read = query.is_read === 'true';
    }

    const [data, total, unread_count] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.notification.count({ where }),

      prisma.notification.count({
        where: { user_id, is_read: false },
      }),
    ]);

    return {
      notifications: data,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        unread_count,
      },
    };
  },

  update: async (notification_id: number, user_id: number) => {
    try {
      const notif = await prisma.notification.findUnique({
        where: { notification_id },
        select: { user_id: true, is_read: true },
      });

      if (!notif || notif.user_id !== user_id) {
        throw new Error('Notification not found or access denied');
      }

      if (notif.is_read) return notif;

      return await prisma.notification.update({
        where: { notification_id },
        data: { is_read: true },
      });
    } catch (error) {
      return handlePrismaError(error, 'Notification');
    }
  },

  bulkRead: async (user_id: number, { ids }: { ids: number[] }) => {
    if (!ids || ids.length === 0) return { count: 0 };

    return prisma.notification.updateMany({
      where: {
        notification_id: { in: ids },
        user_id,
        is_read: false,
      },
      data: { is_read: true },
    });
  },

  remove: async (notification_id: number, user_id: number) => {
    try {
      const notif = await prisma.notification.findUnique({
        where: { notification_id },
        select: { user_id: true },
      });

      if (!notif || notif.user_id !== user_id) {
        throw new Error('Notification not found or access denied');
      }

      return await prisma.notification.delete({
        where: { notification_id },
      });
    } catch (error) {
      return handlePrismaError(error, 'Notification');
    }
  },

  removeMany: async (ids: number[], user_id: number) => {
    if (!ids || ids.length === 0) return { count: 0 };

    try {
      return await prisma.notification.deleteMany({
        where: {
          user_id,
          notification_id: { in: ids },
        },
      });
    } catch (error) {
      return handlePrismaError(error, 'Notification');
    }
  },
};
