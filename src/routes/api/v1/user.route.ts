import type { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { UserService } from '../../../services/user.service.js';
import {
  userController,
  UserController,
} from '../../../controllers/user.controller.js';
import {
  userQuerySchema,
  userSchemas,
} from '../../../validations/user.validation.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export default (router: Router) => {
  const prefix = '/users';
  const userRouter = createCrudRouter(prefix, {
    // createCrudRouter returns an express.Router() instance
    ServiceClass: UserService,
    ControllerClass: UserController,
    idParamName: 'userId',

    schemas: {
      getAll: userQuerySchema,
      create: userSchemas.create,
      update: userSchemas.update,
      params: userSchemas.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin', 'Technician'],
      create: ['SuperAdmin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin'],
    },
  });

  // Menambahkan endpoint kustom untuk riwayat aktivitas
  router.get(
    prefix + '/:userId/activities',
    validate(userSchemas.byId),
    authorize('Admin', 'SuperAdmin', 'Technician'), // Menggunakan otorisasi yang sama dengan getById
    asyncHandler(userController.getActivityHistory)
  );

  router.use(userRouter);
};
