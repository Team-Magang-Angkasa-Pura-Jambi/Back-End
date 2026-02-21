import { type Router } from 'express';
import { validate } from '../../utils/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { dailySummaryController } from './daily_summaries.controller.js';
import { dailySummarySchema } from './daily_summaries.schema.js';

export const dailySummaryRoute = (router: Router) => {
  const prefix = '/daily-summaries';
  router.get(prefix, validate(dailySummarySchema.show), asyncHandler(dailySummaryController.show));
};
