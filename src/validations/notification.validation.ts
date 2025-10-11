import { z } from 'zod';
import { positiveInt } from './schmeHelper.js';

export const getNotificationsSchema = z.object({
  query: z.object({
    page: positiveInt('Page').optional(),
    limit: positiveInt('Limit').optional(),
    isRead: z
      .preprocess(
        (val) => (val === 'true' ? true : val === 'false' ? false : undefined),
        z.boolean().optional()
      )
      .optional(),
  }),
});

export const markAsReadSchema = z.object({
  params: z.object({
    notificationId: positiveInt('Notification ID'),
  }),
});

export const emptySchema = z.object({});

export const bulkDeleteNotificationsSchema = z.object({
  body: z.object({
    notificationIds: z
      .array(positiveInt('Notification ID'))
      .min(1, 'Setidaknya satu ID notifikasi diperlukan.'),
  }),
});
