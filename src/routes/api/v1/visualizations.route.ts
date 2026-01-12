import { type Router } from 'express';
import {
  EnergyOutlookController,
  getBudgetBurnRateController,
  getBudgetTrackingController,
  getDailyAveragePaxController,
  getEfficiencyRatioController,
  getFuelRefillAnalysisController,
  getTrentCounsumptionController,
  getUnifiedComparisonController,
  getYearlyAnalysisController,
  getYearlyHeatmapController,
  MeterRankController,
} from '../../../controllers/report/visualizations.controller.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { validate } from '../../../utils/validate.js';
import {
  getBudgetBurnRateSchema,
  getEfficiencyRatioSchema,
  getFuelRefillAnalysisQuery,
  getTrentCounsumptionSchema,
  getUnifiedComparisonSchema,
  getYearlyHeatmapQuery,
  YearlyAnalysisQuery,
} from '../../../validations/reports/visualizations.validation.js';

export default (router: Router) => {
  const prefix = '/visualizations';

  router.get(prefix + '/meter-rank', asyncHandler(MeterRankController));
  router.get(prefix + '/energy-outlook', asyncHandler(EnergyOutlookController));
  router.get(
    prefix + '/yearly-heatmap',
    validate(getYearlyHeatmapQuery),
    asyncHandler(getYearlyHeatmapController),
  );
  router.get(prefix + '/budget-tracking', asyncHandler(getBudgetTrackingController));

  router.get(
    prefix + '/yearly-analysis',
    validate(YearlyAnalysisQuery),
    asyncHandler(getYearlyAnalysisController),
  );
  router.get(
    prefix + '/unified-comparison',
    validate(getUnifiedComparisonSchema),
    asyncHandler(getUnifiedComparisonController),
  );
  router.get(
    prefix + '/efficiency-ratio',
    validate(getEfficiencyRatioSchema),
    asyncHandler(getEfficiencyRatioController),
  );

  router.get(
    prefix + '/daily-average-pax',
    validate(getEfficiencyRatioSchema),
    asyncHandler(getDailyAveragePaxController),
  );

  router.get(
    prefix + '/budget-burn-rate',
    validate(getBudgetBurnRateSchema),
    asyncHandler(getBudgetBurnRateController),
  );
  router.get(
    prefix + '/fuel-refill-analysis',
    validate(getFuelRefillAnalysisQuery),
    asyncHandler(getFuelRefillAnalysisController),
  );

  router.get(
    prefix + '/trent-consumption',
    validate(getTrentCounsumptionSchema),
    asyncHandler(getTrentCounsumptionController),
  );
};
