// Generated for Sentinel

import { type Router } from 'express';
import { validate } from '../../utils/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { readingTypesController } from './reading-types.controller.js';
import { readingTypesSchema } from './reading-types.schema.js';
import { authorize } from '../../middleware/auth.middleware.js';
import { RoleType } from '../../generated/prisma/index.js';

export const readingTypesRoute = (router: Router) => {
  const prefix = '/reading-types';

  router.get(prefix, validate(readingTypesSchema.show), asyncHandler(readingTypesController.show));
  router.get(
    prefix + '/:id',
    validate(readingTypesSchema.show),
    asyncHandler(readingTypesController.show),
  );

  router.use(prefix, authorize(RoleType.ADMIN, RoleType.SUPER_ADMIN));

  router.post(
    prefix,
    validate(readingTypesSchema.store),
    asyncHandler(readingTypesController.store),
  );

  router.patch(
    prefix + '/:id',
    validate(readingTypesSchema.patch),
    asyncHandler(readingTypesController.patch),
  );

  router.delete(
    prefix + '/:id',
    validate(readingTypesSchema.remove),
    asyncHandler(readingTypesController.remove),
  );
};
