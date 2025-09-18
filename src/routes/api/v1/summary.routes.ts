import type { Router } from 'express';
import { SummaryController } from '../../../controllers/summary.controller.js';
import { SummaryService } from '../../../services/summary.service.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { validate } from '../../../utils/validate.js';
import { getSummarySchema } from '../../../validations/summarry.validation.js';

export const summaryRoutes = (router: Router) => {
  const prefix = '/summary';
  const summaryService = new SummaryService();
  const summaryController = new SummaryController(summaryService);

  router.get(
    prefix,
    validate(getSummarySchema),
    asyncHandler(summaryController.getSummary)
  );
};
