import type { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { SummaryDetailService } from '../../../services/reports/summaryDetail.service.js';
import { SummaryDetailController } from '../../../controllers/report/summaryDetail.controller.js';
import {
  querySchema,
  summaryDetailScheme,
} from '../../../validations/reports/summaryDetail.validation.js';

export default (router: Router) => {
  const summaryDetailRouter = createCrudRouter('/summary-detail', {
    ServiceClass: SummaryDetailService,
    ControllerClass: SummaryDetailController,
    idParamName: 'detailId',

    schemas: {
      getAll: querySchema,
      create: summaryDetailScheme.create,
      update: summaryDetailScheme.update,
      params: summaryDetailScheme.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['SuperAdmin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin'],
    },
  });

  router.use(summaryDetailRouter);
};
