import { type Router } from 'express';
import { rolesController } from './roles.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../utils/validate.js';
import { RolesSchema } from './roles.schema.js';

export const rolesRoute = (router: Router) => {
  const prefix = '/roles';
  router.get(prefix, validate(RolesSchema.show), rolesController.list); // JANGAN pakai variabel prefix
  router.get(prefix + '/:id', validate(RolesSchema.show), rolesController.list); // JANGAN pakai variabel prefix
  router.post(prefix, validate(RolesSchema.store), asyncHandler(rolesController.store));
};
