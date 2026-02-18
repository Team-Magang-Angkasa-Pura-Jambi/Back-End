import { type Router } from 'express';
import { usersController } from './users.controller.js';
import { validate } from '../../utils/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { usersSchema } from './users.schema.js';
import { authorize } from '../../middleware/auth.middleware.js';
import { RoleType } from '../../generated/prisma/index.js';

export const usersRoute = (router: Router) => {
  const prefix = '/users';

  router.get(prefix, validate(usersSchema.show), asyncHandler(usersController.show));

  router.patch(`${prefix}/:id`, validate(usersSchema.patch), asyncHandler(usersController.patch));

  router.get(`${prefix}/:id`, validate(usersSchema.show), asyncHandler(usersController.show));

  router.use(prefix, authorize(RoleType.ADMIN, RoleType.SUPER_ADMIN));

  router.post(prefix, validate(usersSchema.store), asyncHandler(usersController.store));

  router.delete(`${prefix}/:id`, validate(usersSchema.patch), asyncHandler(usersController.remove));
};
