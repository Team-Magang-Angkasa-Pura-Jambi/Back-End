import { type Router } from 'express';
import { authContorller } from './auth.controller.js';
import { validate } from '../../utils/validate.js';
import { authSchema } from './auth.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const authRoute = (router: Router) => {
  const prefix = '/auth';
  router.post(prefix + '/login', validate(authSchema.login), asyncHandler(authContorller.login));
};
