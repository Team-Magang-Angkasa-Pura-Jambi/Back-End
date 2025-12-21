import type { Router } from 'express';
import { ReadingService } from '../../../services/metering/reading.service.js';

import { validate } from '../../../utils/validate.js';
import {
  getHistoryQuerySchema,
  getReadingsSchema,
  queryLastReading,
  readingSessionSchemas,
} from '../../../validations/metering/reading.validation.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import {
  readingController,
  ReadingController,
} from '../../../controllers/metering/reading.controller.js';

const prefix = '/readings';

export default (router: Router) => {
  const userRouter = createCrudRouter(prefix, {
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
      update: ['Technician', 'Admin', 'SuperAdmin'],
      delete: ['Admin', 'SuperAdmin'],
    },
  });

  router.get(
    prefix + '/last',
    validate(queryLastReading),
    asyncHandler(readingController.getLastReading)
  );
  router.get(
    prefix + '/history',
    validate(getHistoryQuerySchema),
    asyncHandler(readingController.findHistory)
  );

  router.use(userRouter);
};
