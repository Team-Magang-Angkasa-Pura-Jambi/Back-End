import type { Router } from 'express';
import { ReadingTypeService } from '../../../services/metering/readingType.service.js';
import { ReadingTypeController } from '../../../controllers/metering/readingType.controller.js';
import {
  queryGetByMeter,
  readingTypeSchema,
} from '../../../validations/metering/readingType.validation.js';
import { createCrudRouter } from '../../../utils/routerFactory.js';

export const readingTypeRoutes = (router: Router) => {
  const readingTypeRouter = createCrudRouter('/reading-types', {
    ServiceClass: ReadingTypeService,
    ControllerClass: ReadingTypeController,
    idParamName: 'readingTypeId',

    schemas: {
      getAll: queryGetByMeter,
      create: readingTypeSchema.create,
      update: readingTypeSchema.update,
      params: readingTypeSchema.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['SuperAdmin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin', 'Admin'],
    },
  });

  router.use(readingTypeRouter);
};
