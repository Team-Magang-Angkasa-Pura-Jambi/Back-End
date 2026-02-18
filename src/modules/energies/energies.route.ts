// Generated for Sentinel Project

import { type Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { energiesController } from './energies.controller.js';
import { validate } from '../../utils/validate.js';
import { energiesSchema } from './energies.schema.js';
import { authorize } from '../../middleware/auth.middleware.js';
import { RoleType } from '../../generated/prisma/index.js';

export const energiesRoute = (router: Router) => {
  const prefix = '/energies';
  router.get(prefix, validate(energiesSchema.show), asyncHandler(energiesController.show));

  router.get(`${prefix}/:id`, validate(energiesSchema.show), asyncHandler(energiesController.show));

  router.use(prefix, authorize(RoleType.ADMIN, RoleType.SUPER_ADMIN));

  router.post(prefix, validate(energiesSchema.store), asyncHandler(energiesController.store));

  router.patch(
    `${prefix}/:id`,
    validate(energiesSchema.patch),
    asyncHandler(energiesController.patch),
  );

  router.delete(
    `${prefix}/:id`,
    validate(energiesSchema.remove),
    asyncHandler(energiesController.remove),
  );
};
