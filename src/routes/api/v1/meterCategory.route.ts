import type { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';

import { MeterCategoryService } from '../../../services/metering/meterCategory.service.js';
import { MeterCategoryController } from '../../../controllers/metering/meterCategory.controller.js';
import { meterCategorySchema } from '../../../validations/metering/meterCategory.validation.js';

export default (router: Router) => {
  const meterCategoryRouter = createCrudRouter('/meters-category', {
    ServiceClass: MeterCategoryService,
    ControllerClass: MeterCategoryController,
    idParamName: 'categoryId',

    schemas: {
      getAll: meterCategorySchema.listQuery,
      create: meterCategorySchema.create,
      update: meterCategorySchema.update,
      params: meterCategorySchema.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['SuperAdmin', 'Admin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin', 'Admin'],
    },
  });

  router.use(meterCategoryRouter);
};
