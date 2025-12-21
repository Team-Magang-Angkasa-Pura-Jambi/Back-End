import type { Request, Response } from 'express';
import type { Notification } from '../generated/prisma/index.js';
import {
  notificationService,
  NotificationService,
} from '../services/notification.service.js';
import type {
  GetNotificationSchemaQuery,
  NotificationSchemaBody,
  UpdateNotificationSchemaBody,
} from '../types/notification.types.js';
import { BaseController } from '../utils/baseController.js';
import { Error401 } from '../utils/customError.js';
import { res200 } from '../utils/response.js';

export class NotificationController extends BaseController<
  Notification,
  NotificationSchemaBody,
  UpdateNotificationSchemaBody,
  GetNotificationSchemaQuery,
  NotificationService
> {
  constructor() {
    // PERBAIKAN: Gunakan instance singleton agar konsisten.
    super(new NotificationService(), 'notificationId');
  }

  public override getAll = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const validatedQuery = res.locals.validatedData.query;
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error401('User not authenticated.');
    }
    // Pastikan userId diambil dari user yang terautentikasi untuk keamanan
    validatedQuery.userId = userId;

    const data = await this.service.findAllWithQuery(validatedQuery);
    res200({
      res,
      message: 'Successfully retrieved notifications.',
      data: { data },
    });
  };

  public getUnreadCount = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error401('User not authenticated.');
    }
    const count = await this.service.getUnreadCount(userId);
    res200({
      res,
      message: 'Successfully retrieved unread notification count.',
      data: { count },
    });
  };

  public markAsRead = async (req: Request, res: Response): Promise<void> => {
    const { notificationId } = res.locals.validatedData.params;
    const result = await this.service.markAsRead(notificationId);
    res200({ res, message: 'Notification marked as read.', data: result });
  };

  public markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error401('User not authenticated.');
    }
    const result = await this.service.markAllAsRead(userId);
    res200({ res, message: 'All notifications marked as read.', data: result });
  };

  public getLatest = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error401('User not authenticated.');
    }
    const result = await this.service.getLatest(userId);
    res200({
      res,
      message: 'Successfully retrieved latest notifications.',
      data: result,
    });
  };

  public deleteAll = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error401('User not authenticated.');
    }
    const result = await this.service.deleteAll(userId);
    res200({
      res,
      message: `Successfully deleted ${result.count} notifications.`,
    });
  };

  public bulkDelete = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error401('User not authenticated.');
    }

    const { notificationIds } = res.locals.validatedData.body;

    const result = await this.service.deleteManyByIds(userId, notificationIds);

    res200({
      res,
      message: `Successfully deleted ${result.count} notifications.`,
      data: {
        count: result.count,
      },
    });
  };
}

// export const notificationController = new NotificationController();
