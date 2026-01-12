// src/services/notification.service.ts

import prisma from '../../configs/db.js';
import type { Prisma } from '../../generated/prisma/index.js';
// import { socketServer } from '../socket-instance.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';
import type { UpdateNotificationSchemaBody } from '../../types/operations/notification.types.js';
import { SocketServer } from '../../configs/socket.js';

type CreateNotificationInput = {
  user_id: number;
  title: string;
  message: string;
  link?: string;
};

export class NotificationService extends GenericBaseService<
  typeof prisma.notification,
  Prisma.NotificationGetPayload<{}>,
  CreateNotificationInput,
  UpdateNotificationSchemaBody,
  Prisma.NotificationFindManyArgs,
  Prisma.NotificationFindUniqueArgs,
  Prisma.NotificationCreateArgs,
  Prisma.NotificationUpdateArgs,
  Prisma.NotificationDeleteArgs
> {
  constructor() {
    super(prisma, prisma.notification, 'notification_id');
  }

  /**
   * Membuat notifikasi di database dan mengirim sinyal real-time ke pengguna.
   * @param data - Data notifikasi yang akan dibuat.
   */
  public async create(data: CreateNotificationInput): Promise<any> {
    return this._handleCrudOperation(async () => {
      // 1. Simpan notifikasi ke database
      const newNotification = this._handleCrudOperation(() =>
        prisma.notification.create({ data })
      );

      // 2. Kirim sinyal ke client melalui WebSocket bahwa ada notifikasi baru.
      //    Client kemudian bisa melakukan fetch untuk mendapatkan notifikasi terbaru.
      // PERBAIKAN: Gunakan instance singleton yang benar untuk mengakses server socket.
      SocketServer.instance.io
        .to(String(data.user_id))
        .emit('new_notification_available');

      return newNotification;
    });
  }

  public async getAllNotification(userId: number) {
    try {
      const [notifications, total] = await prisma.$transaction([
        prisma.notification.findMany({
          where: {
            user_id: userId,
          },
          orderBy: {
            created_at: 'desc',
          },
        }),
        prisma.notification.count({
          where: {
            user_id: userId,
          },
        }),
      ]);

      return {
        data: notifications,
        meta: {
          total: total,
        },
      };
    } catch (error) {
      console.error('Error fetching meter alerts:', error);
      throw new Error('Gagal mengambil data alert meteran.');
    }
  }

  public async markAsRead(notificationId: number) {
    return this._handleCrudOperation(async () => {
      return prisma.notification.update({
        where: { notification_id: notificationId },
        data: { is_read: true },
      });
    });
  }

  public async markAllAsRead(userId: number) {
    return this._handleCrudOperation(async () => {
      return prisma.notification.updateMany({
        where: {
          user_id: userId,
          is_read: false,
        },
        data: { is_read: true },
      });
    });
  }

  public async getLatest(userId: number) {
    return this._handleCrudOperation(async () => {
      return prisma.notification.findMany({
        where: {
          user_id: userId,
        },
        take: 5,
        orderBy: {
          created_at: 'desc',
        },
      });
    });
  }

  public async deleteAll(userId: number): Promise<Prisma.BatchPayload> {
    return this._handleCrudOperation(() =>
      this._model.deleteMany({
        where: { user_id: userId },
      })
    );
  }

  public async deleteManyByIds(
    userId: number,
    notificationIds: number[]
  ): Promise<Prisma.BatchPayload> {
    return this._handleCrudOperation(() =>
      this._model.deleteMany({
        where: {
          user_id: userId,
          notification_id: { in: notificationIds },
        },
      })
    );
  }

  public async deleteOldRead(olderThan: Date): Promise<Prisma.BatchPayload> {
    return this._handleCrudOperation(() =>
      this._model.deleteMany({
        where: {
          is_read: true,
          created_at: {
            lt: olderThan,
          },
        },
      })
    );
  }
}

export const notificationService = new NotificationService();
