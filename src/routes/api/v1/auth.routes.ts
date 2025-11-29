import type { Router } from 'express';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { authController } from '../../../controllers/auth.controller.js';
import { loginSchema } from '../../../validations/auth.validation.js';

export const authRoutes = (router: Router) => {
  const prefix = '/auth';
  router.post(
    prefix + '/login',
    validate(loginSchema),
    asyncHandler(authController.login)
  );
};
