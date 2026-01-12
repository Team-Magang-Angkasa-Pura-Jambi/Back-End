import type { Request, Response } from 'express';
import type { Notification } from '../../generated/prisma/index.js';
import {
  notificationService,
  NotificationService,
} from '../../services/notifications/notification.service.js';
import type {
  CreateNotificationInput,
  GetNotificationSchemaQuery,
  NotificationSchemaBody,
  UpdateNotificationSchemaBody,
} from '../../types/operations/notification.types.js';
import { BaseController } from '../../utils/baseController.js';
import { Error401 } from '../../utils/customError.js';
import { res200 } from '../../utils/response.js';

export class NotificationController extends BaseController<
  Notification,
  CreateNotificationInput,
  UpdateNotificationSchemaBody,
  GetNotificationSchemaQuery,
  NotificationService
> {
  constructor() {
    super(new NotificationService(), 'notificationId');
  }

  public override getAll = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error401('User not authenticated.');
    }

    const { data, meta } = await this.service.getAllNotification(userId);
    res200({
      res,
      message: 'Successfully retrieved notifications.',
      data: {
        notifications: data,
        data: { meters: data, meta },
      },
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
}
