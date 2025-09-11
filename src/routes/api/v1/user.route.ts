import type { Router } from 'express';

import { UserController } from '../../../controllers/user.controller.js';
import { userService } from '../../../services/user.service.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import {
  createUserSchema,
  updateUserSchema,
} from '../../../validations/auth.validation.js';
import {
  authMiddleware,
  authorize,
} from '../../../middleware/auth.middleware.js';
import { getUsersSchema } from '../../../validations/user.validation.js';

export const userRoutes = (router: Router) => {
  const prefix = '/users';
  const userController = new UserController(userService);

  router.post(
    prefix + '/',
    validate(createUserSchema),
    asyncHandler(userController.createUser)
  );

  router.use(authMiddleware);

  router.get(
    prefix + '/',
    authorize('Admin', 'SuperAdmin'),
    validate(getUsersSchema),
    asyncHandler(userController.getUsers)
  );

  router.get(prefix + '/me', asyncHandler(userController.getUserProfile));

  router.get(
    prefix + '/:userId',
    authorize('Admin', 'SuperAdmin'),
    asyncHandler(userController.getUser)
  );

  router.delete(
    prefix + '/:userId',
    authorize('Admin', 'SuperAdmin'),
    asyncHandler(userController.deleteUser)
  );

  router.patch(
    prefix + '/:userId',
    authorize('Admin', 'SuperAdmin'),
    validate(updateUserSchema),
    asyncHandler(userController.updateUser)
  );
};
