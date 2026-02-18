// Generated for Sentinel Project

import { type Router } from 'express';
import { validate } from '../../utils/validate.js';
import { locationSchema } from './locations.schema.js';
import { locationsController } from './locations.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authorize } from '../../middleware/auth.middleware.js';
import { RoleType } from '../../generated/prisma/index.js';

export const locationsRoute = (router: Router) => {
  const prefix = '/locations';

  router.get(prefix, validate(locationSchema.show), asyncHandler(locationsController.show));

  router.get(
    `${prefix}/:id`,
    validate(locationSchema.show),
    asyncHandler(locationsController.show),
  );

  router.use(prefix, authorize(RoleType.ADMIN, RoleType.SUPER_ADMIN));

  router.post(prefix, validate(locationSchema.store), asyncHandler(locationsController.store));

  router.patch(
    `${prefix}/:id`,
    validate(locationSchema.patch),
    asyncHandler(locationsController.patch),
  );

  router.delete(
    `${prefix}/:id`,
    validate(locationSchema.remove),
    asyncHandler(locationsController.remove),
  );
};
