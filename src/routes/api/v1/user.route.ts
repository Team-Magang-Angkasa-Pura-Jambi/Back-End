import type { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { UserService } from '../../../services/user.service.js';
import { UserController } from '../../../controllers/user.controller.js';
import {
  userQuerySchema,
  userSchemas,
} from '../../../validations/user.validation.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export default (router: Router) => {
  const userRouter = createCrudRouter('/users', {
    ServiceClass: UserService,
    ControllerClass: UserController,
    idParamName: 'userId',

    schemas: {
      // getAll: ,
      create: userSchemas.create,
      update: userSchemas.update,
      params: userSchemas.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['SuperAdmin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin'],
    },
  });

  router.use(userRouter);
};
