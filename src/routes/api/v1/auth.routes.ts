import type { Router } from 'express';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AuthController } from '../../../controllers/auth.controller.js';
import { loginSchema } from '../../../validations/auth.validation.js';
import { authService } from '../../../services/auth.service.js';

export const authRoutes = (router: Router) => {
  const prefix = '/auth';
  const authController = new AuthController(authService);
  router.post(
    prefix + '/login',
    validate(loginSchema),
    asyncHandler(authController.login)
  );
};
