import { Router } from 'express';

import { visualizationSchema } from './visualization.schema.js';
import { visualizationController } from './visualization.controller.js';
import { validate } from '../../utils/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const visualizationRoute = (router: Router) => {
  const prefix = '/visualizations';

  router.get(
    `${prefix}/metric-cards`,
    validate(visualizationSchema.metricCards),
    asyncHandler(visualizationController.MetricCards),
  );
  router.get(
    `${prefix}/yearly-heatmap`,
    validate(visualizationSchema.yearlyHeatmap),
    asyncHandler(visualizationController.YearlyHeatmap),
  );
  router.get(
    `${prefix}/yearly-analysis`,
    validate(visualizationSchema.yearlyAnalysis),
    asyncHandler(visualizationController.yearlyAnalysis),
  );
  router.get(
    `${prefix}/trent-consumption`,
    validate(visualizationSchema.trentConsumption),
    asyncHandler(visualizationController.trentConsumption),
  );
  router.get(
    `${prefix}/energy-pax-correlation`,
    validate(visualizationSchema.getEnergyPaxCorrelation),
    asyncHandler(visualizationController.getEnergyPaxCorrelation),
  );
  router.get(
    `${prefix}/yearly-logistics`,
    validate(visualizationSchema.getYearlyLogistics),
    asyncHandler(visualizationController.getYearlyLogistics),
  );
  router.get(
    `${prefix}/today-summary`,
    validate(visualizationSchema.GetTodaySummaryQuerySchema),
    asyncHandler(visualizationController.getTodaySummary),
  );
  router.get(
    `${prefix}/card-config`,
    asyncHandler(visualizationController.getCardConfig),
  );
  router.put(
    `${prefix}/card-config`,
    validate(visualizationSchema.updateDashboardCardConfig),
    asyncHandler(visualizationController.updateCardConfig),
  );
};
