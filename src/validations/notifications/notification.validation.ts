import { z } from 'zod';
import { positiveInt } from '../../utils/schmeHelper.js';

export const getNotificationsSchema = z.object({
  query: z.object({
    page: positiveInt('Page').optional(),
    limit: positiveInt('Limit').optional(),
    isRead: z
      .preprocess(
        (val) => (val === 'true' ? true : val === 'false' ? false : undefined),
        z.boolean().optional(),
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

// Tambahkan ini
export const createNotificationSchema = z.object({
  body: z.object({
    user_id: positiveInt('User ID'),
    title: z.string().min(1, 'Title wajib diisi'),
    message: z.string().min(1, 'Message wajib diisi'),
    link: z.string().optional(),
    // is_read tidak perlu karena default false di database
  }),
});
