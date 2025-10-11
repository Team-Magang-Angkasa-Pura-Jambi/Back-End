import { Router } from 'express';
import { notificationController } from '../../../controllers/notification.controller.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import {
  authorize,
  authMiddleware,
} from '../../../middleware/auth.middleware.js';
import {
  bulkDeleteNotificationsSchema,
  getNotificationsSchema,
  emptySchema,
  markAsReadSchema,
} from '../../../validations/notification.validation.js';

export default (router: Router) => {
  const prefix = '/notifications';

  // Menerapkan middleware otentikasi untuk semua rute notifikasi

  // GET /api/v1/notifications - Mengambil semua notifikasi untuk pengguna yang login
  router.get(
    prefix,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getNotificationsSchema),
    asyncHandler(notificationController.getAll)
  );

  // GET /api/v1/notifications/unread-count - Menghitung notifikasi yang belum dibaca
  router.get(
    `${prefix}/unread-count`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    asyncHandler(notificationController.getUnreadCount)
  );

  // GET /api/v1/notifications/latest - Mengambil 5 notifikasi terbaru
  router.get(
    `${prefix}/latest`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    asyncHandler(notificationController.getLatest)
  );

  // PATCH /api/v1/notifications/mark-all-as-read - Menandai semua notifikasi sebagai sudah dibaca
  router.patch(
    `${prefix}/mark-all-as-read`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    asyncHandler(notificationController.markAllAsRead)
  );

  // PATCH /api/v1/notifications/:notificationId/mark-as-read - Menandai satu notifikasi sebagai sudah dibaca
  router.patch(
    `${prefix}/:notificationId/mark-as-read`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(markAsReadSchema),
    asyncHandler(notificationController.markAsRead)
  );

  // DELETE /api/v1/notifications - Menghapus semua notifikasi untuk pengguna yang login
  router.delete(
    prefix,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(emptySchema),
    asyncHandler(notificationController.deleteAll)
  );

  // POST /api/v1/notifications/bulk-delete - Menghapus beberapa notifikasi yang dipilih
  router.post(
    `${prefix}/bulk-delete`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(bulkDeleteNotificationsSchema),
    asyncHandler(notificationController.bulkDelete)
  );
};
