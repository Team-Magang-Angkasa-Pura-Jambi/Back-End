import type { Router } from 'express';
import {
  userController,
  UserController,
} from '../../../controllers/user.controller.js';
import { userService } from '../../../services/user.service.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

import {
  authMiddleware,
  authorize,
} from '../../../middleware/auth.middleware.js';
import {
  createUserSchema,
  deleteUserSchema,
  getUserSchema,
  getUsersSchema,
  updateUserSchema,
} from '../../../validations/user.validation.js';

export const userRoutes = (router: Router) => {
  const prefix = '/users';

  router.get(
    prefix + '/',
    authorize('Admin', 'SuperAdmin'),
    validate(getUsersSchema),
    asyncHandler(userController.getUsers)
  );

  router.get(
    prefix + '-active',
    authorize('SuperAdmin'),
    validate(getUsersSchema),
    asyncHandler(userController.getActiveUsers)
  );

  router.get(prefix + '/me', asyncHandler(userController.getUserProfile));

  router.get(
    prefix + '/:userId',
    authorize('SuperAdmin'),
    validate(getUserSchema),
    asyncHandler(userController.getUser)
  );
  router.post(
    prefix + '/',
    authorize('SuperAdmin'),
    validate(createUserSchema),
    asyncHandler(userController.createUser)
  );

  router.use(authMiddleware);

  router.delete(
    prefix + '/:userId',
    authorize('SuperAdmin'),
    validate(deleteUserSchema),
    asyncHandler(userController.deleteUser)
  );

  router.patch(
    prefix + '/:userId',
    authorize('Admin', 'SuperAdmin'),
    validate(updateUserSchema),
    asyncHandler(userController.updateUser)
  );
};
