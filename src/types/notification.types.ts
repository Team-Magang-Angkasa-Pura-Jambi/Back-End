import { z } from 'zod';
import type { notificationSchema } from '../validations/notification.validation.js';

export type NotificationSchemaBody = z.infer<typeof notificationSchema.create>;

export type UpdateNotificationSchemaBody = z.infer<
  typeof notificationSchema.update
>;

export type NotificationSchemaParams = z.infer<
  typeof notificationSchema.params
>;

export type GetNotificationSchemaQuery = z.infer<
  typeof notificationSchema.listQuery
>;
