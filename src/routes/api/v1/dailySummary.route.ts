import type { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { DailySummaryService } from '../../../services/reports/dailySummary.service.js';
import { DailySummaryController } from '../../../controllers/report/dailySummary.controller.js';
import {
  getMonthlyReportSchema,
  querySchema,
  summaryScheme,
} from '../../../validations/reports/dailySummary.validation.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export default (router: Router) => {
  const prefix = '/daily-summary';

  router.get(
    prefix + '/reports-monthly',
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getMonthlyReportSchema),
    asyncHandler(DailySummaryController.getMonthlyReport),
  );

  const dailySummaryRouter = createCrudRouter(prefix, {
    ServiceClass: DailySummaryService,
    ControllerClass: DailySummaryController,
    idParamName: 'summaryId',

    schemas: {
      getAll: querySchema,
      create: summaryScheme.create,
      update: summaryScheme.update,
      params: summaryScheme.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['SuperAdmin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin'],
    },
  });

  router.use(dailySummaryRouter);
};
