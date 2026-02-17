import { type Router } from 'express';
import { usersController } from './users.controller.js';
import { validate } from '../../utils/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { usersSchema } from './users.schema.js';

export const usersRoute = (router: Router) => {
  const prefix = '/users';

  router.post(prefix, validate(usersSchema.store), asyncHandler(usersController.store));

  router.get(prefix, validate(usersSchema.show), asyncHandler(usersController.show));

  router.get(`${prefix}/:id`, validate(usersSchema.show), asyncHandler(usersController.show));

  router.patch(`${prefix}/:id`, validate(usersSchema.patch), asyncHandler(usersController.patch));

  router.delete(`${prefix}/:id`, validate(usersSchema.patch), asyncHandler(usersController.remove));
};
