import { type Router } from 'express';
import { notificationsController } from './notifications.controller.js';
import { validate } from '../../utils/validate.js';
import { notificationsSchema } from './notifications.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const notificationsRouter = (router: Router) => {
  const prefix = '/notifications';

  router.get(
    prefix,
    validate(notificationsSchema.show),
    asyncHandler(notificationsController.show),
  );

  router.patch(
    prefix + '/bulk-read',
    validate(notificationsSchema.bulkRead),
    asyncHandler(notificationsController.bulkRead),
  );

  router.post(
    prefix + '/bulk-remove',
    validate(notificationsSchema.removeMany),
    asyncHandler(notificationsController.removeMany),
  );

  router.post(
    prefix,
    validate(notificationsSchema.store),
    asyncHandler(notificationsController.store),
  );

  router.patch(
    prefix + '/:id/read',
    validate(notificationsSchema.update),
    asyncHandler(notificationsController.update),
  );

  router.delete(
    prefix + '/:id',
    validate(notificationsSchema.remove),
    asyncHandler(notificationsController.remove),
  );
};
