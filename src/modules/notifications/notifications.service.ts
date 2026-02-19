import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type NotificationsPayload } from './notifications.type.js';

export const notificationsService = {
  store: async (data: NotificationsPayload) => {
    return prisma.notification.create({
      data: {
        user: {
          connect: { user_id: data.user_id },
        },
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

    const where: any = { user_id };
    if (query.is_read !== undefined) {
      where.is_read = query.is_read === 'true';
    }

    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        unread_count: await prisma.notification.count({
          where: { user_id: user_id, is_read: false },
        }),
      },
    };
  },

  update: async (notification_id: number, user_id: number) => {
    try {
      const notif = await prisma.notification.findFirst({
        where: { notification_id, user_id },
      });

      if (!notif) throw new Error('Notification not found or access denied');

      return prisma.notification.update({
        where: { notification_id },
        data: { is_read: true },
      });
    } catch (error) {
      return handlePrismaError(error, 'Notification');
    }
  },

  bulkRead: async (user_id: number, { ids }: { ids: number[] }) => {
    // Safety check
    if (!ids || ids.length === 0) return { count: 0 };

    return prisma.notification.updateMany({
      where: {
        notification_id: {
          in: ids, // <--- Sekarang 'ids' adalah [1, 2, 3] (Array murni)
        },
        user_id,
        is_read: false,
      },
      data: { is_read: true },
    });
  },

  remove: async (notificationId: number, userId: number) => {
    try {
      const notif = await prisma.notification.findFirst({
        where: { notification_id: notificationId, user_id: userId },
      });

      if (!notif) throw new Error('Notification not found');

      return prisma.notification.delete({
        where: { notification_id: notificationId },
      });
    } catch (error) {
      return handlePrismaError(error, 'Notification');
    }
  },

  removeMany: async (ids: number[], userId: number) => {
    try {
      return prisma.notification.deleteMany({
        where: {
          user_id: userId,
          notification_id: { in: ids },
        },
      });
    } catch (error) {
      return handlePrismaError(error, 'Notification');
    }
  },
};
