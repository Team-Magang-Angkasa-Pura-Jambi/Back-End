import type { Router } from 'express';
import { ReadingService } from '../../../services/reading.service.js';
import {
  readingController,
  ReadingController,
} from '../../../controllers/reading.controller.js';
import { validate } from '../../../utils/validate.js';
import {
  getReadingsSchema,
  queryLastReading,
  readingSessionSchemas,
} from '../../../validations/reading.validation.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { authorize } from '../../../middleware/auth.middleware.js';

export const readingRoutes = (router: Router) => {
  const userRouter = createCrudRouter('/readings', {
    ServiceClass: ReadingService,
    ControllerClass: ReadingController,
    idParamName: 'sessionId',

    schemas: {
      getAll: getReadingsSchema,
      create: readingSessionSchemas.create,
      update: readingSessionSchemas.update,
      params: readingSessionSchemas.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['Technician', 'Admin', 'SuperAdmin'],
      update: ['SuperAdmin'],
      delete: ['Admin', 'SuperAdmin'],
    },
  });

  const prefix = '/readings';
  router.get(
    prefix + '/last',
    validate(queryLastReading),
    asyncHandler(readingController.getLastReading)
  );

  router.use(userRouter);
};
