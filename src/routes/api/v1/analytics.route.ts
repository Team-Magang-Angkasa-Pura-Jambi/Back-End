import { type Router } from 'express';
import { authorize } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { analysisController } from '../../../controllers/report/analysis.controller.js';
import { todaySummaryQuerySchema } from '../../../validations/reports/analysis.validation.js';

export default (router: Router) => {
  const prefix = '/analytics';

  router.get(
    `${prefix}/today-summary`,
    authorize('Technician', 'Admin', 'SuperAdmin'),
    validate(todaySummaryQuerySchema),
    asyncHandler(analysisController.getTodaySummary),
  );
};
