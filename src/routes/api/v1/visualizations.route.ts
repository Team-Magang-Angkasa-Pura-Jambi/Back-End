import { Router } from 'express';
import {
  EnergyOutlookController,
  getBudgetTrackingController,
  getEfficiencyRatioController,
  getUnifiedComparisonController,
  getYearlyAnalysisController,
  getYearlyHeatmapController,
  MeterRankController,
} from '../../../controllers/report/visualizations.controller.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { validate } from '../../../utils/validate.js';
import {
  getEfficiencyRatioSchema,
  getUnifiedComparisonSchema,
  getYearlyHeatmapQuery,
  YearlyAnalysisQuery,
} from '../../../validations/reports/visualizations.validation.js';
import { get } from 'http';

export default (router: Router) => {
  const prefix = '/visualizations';

  router.get(prefix + '/meter-rank', asyncHandler(MeterRankController));
  router.get(prefix + '/energy-outlook', asyncHandler(EnergyOutlookController));
  router.get(
    prefix + '/yearly-heatmap',
    validate(getYearlyHeatmapQuery),
    asyncHandler(getYearlyHeatmapController)
  );
  router.get(
    prefix + '/budget-tracking',
    asyncHandler(getBudgetTrackingController)
  );

  router.get(
    prefix + '/yearly-analysis',
    validate(YearlyAnalysisQuery),
    asyncHandler(getYearlyAnalysisController)
  );
  router.get(
    prefix + '/unified-comparison',
    validate(getUnifiedComparisonSchema),
    asyncHandler(getUnifiedComparisonController)
  );
  router.get(
    prefix + '/efficiency-ratio',
    validate(getEfficiencyRatioSchema),
    asyncHandler(getEfficiencyRatioController)
  );
};
