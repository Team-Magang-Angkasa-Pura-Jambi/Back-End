import { z } from 'zod';
import {
  bulkDeleteNotificationsSchema,
  createNotificationSchema,
  getNotificationsSchema,
  markAsReadSchema,
} from '../../validations/notifications/notification.validation.js';

export type NotificationSchemaBody = z.infer<
  typeof bulkDeleteNotificationsSchema
>['body'];
export type CreateNotificationInput = z.infer<
  typeof createNotificationSchema
>['body'];


export type UpdateNotificationSchemaBody = Partial<NotificationSchemaBody>;

export type NotificationSchemaParams = z.infer<
  typeof markAsReadSchema
>['params'];

export type GetNotificationSchemaQuery = z.infer<
  typeof getNotificationsSchema
>['query'];
