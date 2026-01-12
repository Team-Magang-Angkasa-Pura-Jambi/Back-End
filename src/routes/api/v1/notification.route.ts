import { type Router } from 'express';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import {
  bulkDeleteNotificationsSchema,
  emptySchema,
  markAsReadSchema,
} from '../../../validations/notifications/notification.validation.js';
import { NotificationController } from '../../../controllers/notifications/notification.controller.js';

export default (router: Router) => {
  const prefix = '/notifications';
  const notificationController = new NotificationController();

  router.get(
    prefix,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    asyncHandler(notificationController.getAll),
  );

  router.patch(
    `${prefix}/:notificationId/mark-as-read`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(markAsReadSchema),
    asyncHandler(notificationController.markAsRead),
  );

  router.patch(
    `${prefix}/bulk-read`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    asyncHandler(notificationController.markAllAsRead),
  );

  router.delete(
    prefix,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(emptySchema),
    asyncHandler(notificationController.deleteAll),
  );

  router.post(
    `${prefix}/bulk-delete`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(bulkDeleteNotificationsSchema),
    asyncHandler(notificationController.bulkDelete),
  );

  router.get(
    `${prefix}/latest`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    asyncHandler(notificationController.getLatest),
  );
};
