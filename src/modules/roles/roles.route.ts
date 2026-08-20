import { type Router } from 'express';
import { rolesController } from './roles.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../utils/validate.js';
import { RolesSchema } from './roles.schema.js';
import { authorize } from '../../middleware/auth.middleware.js';
import { RoleType } from '../../generated/prisma/index.js';

export const rolesRoute = (router: Router) => {
  const prefix = '/roles';

  router.get(prefix, validate(RolesSchema.show), rolesController.list);

  router.use(prefix, authorize(RoleType.ADMIN, RoleType.SUPER_ADMIN));

  router.get(prefix + '/:id', validate(RolesSchema.show), rolesController.list);

  router.post(prefix, validate(RolesSchema.store), asyncHandler(rolesController.store));
};
