import { Router } from 'express';
import { ReadingDetailService } from '../../../services/readingDetail.service.js';
import { ReadingDetailController } from '../../../controllers/readingDetail.controller.js';
import { readingDetailSchema } from '../../../validations/readingDetail.validations.js';
import { createCrudRouter } from '../../../utils/routerFactory.js';

export default (router: Router) => {
  const readingDetailRouter = createCrudRouter('/reading-details', {
    ServiceClass: ReadingDetailService,
    ControllerClass: ReadingDetailController,
    idParamName: 'detailId',

    schemas: {
      getAll: readingDetailSchema.listQuery,
      create: readingDetailSchema.create,
      update: readingDetailSchema.update,
      params: readingDetailSchema.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['SuperAdmin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin'],
    },
  });

  router.use(readingDetailRouter);
};
