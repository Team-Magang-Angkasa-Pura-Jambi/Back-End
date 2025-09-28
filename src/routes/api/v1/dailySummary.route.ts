import type { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { DailySummaryService } from '../../../services/dailySummary.service.js';
import {
  dailySummaryController,
  DailySummaryController,
} from '../../../controllers/dailySummary.controller.js';
import {
  getMonthlyReportSchema,
  querySchema,
  summaryScheme,
} from '../../../validations/dailySummary.validation.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export default (router: Router) => {
  const dailySummaryRouter = createCrudRouter('/daily-summary', {
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

  dailySummaryRouter.get(
    '/daily-summary/reports/monthly',
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getMonthlyReportSchema),
    asyncHandler(DailySummaryController.getMonthlyReport)
  );

  router.use(dailySummaryRouter);
};
