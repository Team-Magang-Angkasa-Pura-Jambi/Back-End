// Placeholder

import type { Router } from 'express';
import { ChartService } from '../../../services/chart.service.js';
import { ChartController } from '../../../controllers/chart.controller.js';
import { getChartDataSchema } from '../../../validations/chart.validation.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export const chartRoutes = (router: Router) => {
  const prefix = '/chart-data';
  const chartService = new ChartService();
  const chartController = new ChartController(chartService);

  router.get(
    prefix,
    // isAuthenticated,
    validate(getChartDataSchema),
    asyncHandler(chartController.getChartData)
  );
};
