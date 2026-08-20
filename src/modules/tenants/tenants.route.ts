import { type Router } from 'express';
import { RoleType } from '../../generated/prisma/index.js';
import { validate } from '../../utils/validate.js';
import { tenantsSchema } from './tenants.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { tenantsControllers } from './tenants.controller.js';
import { authorize } from '../../middleware/auth.middleware.js';

// Generated for Sentinel Project
export const tenantsRoute = (router: Router) => {
  const prefix = '/tenants';

  router.get(prefix, validate(tenantsSchema.show), asyncHandler(tenantsControllers.show));

  router.get(prefix + '/categories', asyncHandler(tenantsControllers.showCategories));

  router.get(prefix + '/:id', validate(tenantsSchema.show), asyncHandler(tenantsControllers.show));

  router.use(prefix, authorize(RoleType.ADMIN, RoleType.SUPER_ADMIN));

  router.post(prefix, validate(tenantsSchema.store), asyncHandler(tenantsControllers.store));

  router.patch(
    prefix + '/:id',
    validate(tenantsSchema.patch),
    asyncHandler(tenantsControllers.patch),
  );
  router.delete(
    prefix + '/:id',
    validate(tenantsSchema.remove),
    asyncHandler(tenantsControllers.remove),
  );
};
