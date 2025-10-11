// src/services/notification.service.ts

import prisma from '../configs/db.js';
import type { Prisma } from '../generated/prisma/index.js';
import { socketServer } from '../socket-instance.js';
import type { GetNotificationSchemaQuery } from '../types/notification.types.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';
import type {
  NotificationSchemaBody,
  UpdateNotificationSchemaBody,
} from '../types/notification.types.js';

type CreateNotificationInput = {
  user_id: number;
  title: string;
  message: string;
  link?: string;
};

export class NotificationService extends GenericBaseService<
  typeof prisma.notification,
  Prisma.NotificationGetPayload<{}>,
  NotificationSchemaBody,
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
  public async create(data: CreateNotificationInput) {
    return this._handleCrudOperation(async () => {
      // 1. Simpan notifikasi ke database
      const newNotification = await this._prisma.notification.create({
        data,
      });

      // 2. Kirim sinyal ke client melalui WebSocket bahwa ada notifikasi baru.
      //    Client kemudian bisa melakukan fetch untuk mendapatkan notifikasi terbaru.
      socketServer.io
        .to(String(data.user_id))
        .emit('new_notification_available');

      return newNotification;
    });
  }

  public async findAllWithQuery(query: GetNotificationSchemaQuery) {
    return this._handleCrudOperation(async () => {
      const { limit = 10, page = 1, userId, isRead } = query;
      const where: Prisma.NotificationWhereInput = {
        user_id: userId,
        ...(isRead !== undefined && { is_read: isRead }),
      };

      return this._prisma.notification.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { created_at: 'desc' },
      });
    });
  }

  public async getUnreadCount(userId: number): Promise<number> {
    return this._handleCrudOperation(async () => {
      return this._prisma.notification.count({
        where: {
          user_id: userId,
          is_read: false,
        },
      });
    });
  }

  public async markAsRead(notificationId: number) {
    return this._handleCrudOperation(async () => {
      return this._prisma.notification.update({
        where: { notification_id: notificationId },
        data: { is_read: true },
      });
    });
  }

  public async markAllAsRead(userId: number) {
    return this._handleCrudOperation(async () => {
      return this._prisma.notification.updateMany({
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
      return this._prisma.notification.findMany({
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

  /**
   * BARU: Menghapus semua notifikasi untuk pengguna tertentu.
   * @param userId - ID pengguna yang notifikasinya akan dihapus.
   * @returns Hasil dari operasi deleteMany.
   */
  public async deleteAll(userId: number): Promise<Prisma.BatchPayload> {
    return this._handleCrudOperation(() =>
      this._model.deleteMany({
        where: { user_id: userId },
      })
    );
  }

  /**
   * BARU: Menghapus beberapa notifikasi berdasarkan daftar ID.
   * @param userId - ID pengguna yang terautentikasi.
   * @param notificationIds - Array dari ID notifikasi yang akan dihapus.
   * @returns Hasil dari operasi deleteMany.
   */
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

  /**
   * BARU: Menghapus notifikasi lama yang sudah dibaca.
   * @param olderThan - Hapus notifikasi yang dibuat sebelum tanggal ini.
   * @returns Hasil dari operasi deleteMany.
   */
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
