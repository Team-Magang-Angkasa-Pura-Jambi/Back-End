import { Router } from 'express';
import {
  authMiddleware,
  authorize,
} from '../../../middleware/auth.middleware.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { analysisController } from '../../../controllers/report/analysis.controller.js';
import {
  analysisQuerySchema,
  budgetAllocationQuerySchema,
  budgetPreviewSchema,
  bulkPredictionSchema,
  classificationSummaryQuerySchema,
  efficiencyTargetPreviewSchema,
  fuelStockAnalysisQuerySchema,
  monthlyRecapSchema,
  prepareBudgetSchema,
  singlePredictionSchema,
  todaySummaryQuerySchema,
} from '../../../validations/reports/analysis.validation.js';
import { recapController } from '../../../controllers/report/recap.controller.js';

export default (router: Router) => {
  const prefix = '/analysis';

  router.use(prefix, authMiddleware);
  // data untuk line chart
  router.get(
    prefix,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(analysisQuerySchema),
    asyncHandler(analysisController.getMonthlyAnalysis)
  );

  router.get(
    `${prefix}/fuel-stock`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(fuelStockAnalysisQuerySchema),
    asyncHandler(analysisController.getMonthlyFuelStockAnalysis)
  );
  // summary
  router.get(
    `${prefix}/classification-summary`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(classificationSummaryQuerySchema),
    asyncHandler(analysisController.getClassificationSummary)
  );
  router.get(
    `${prefix}/today-summary`,
    authorize('Technician', 'Admin', 'SuperAdmin'),
    validate(todaySummaryQuerySchema),
    asyncHandler(analysisController.getTodaySummary)
  );
  // budget
  router.get(
    `${prefix}/budget-allocation`,
    authorize('Admin', 'SuperAdmin'),
    validate(budgetAllocationQuerySchema),
    asyncHandler(analysisController.getBudgetAllocation)
  );

  router.post(
    `${prefix}/budget-preview`,
    authorize('Admin', 'SuperAdmin'),
    validate(budgetPreviewSchema),
    asyncHandler(analysisController.getBudgetPreview)
  );

  router.get(
    `${prefix}/budget-summary`,
    authorize('Admin', 'SuperAdmin'),

    asyncHandler(analysisController.getBudgetSummary)
  );

   router.get(
     `${prefix}/prepare-budget/:parentBudgetId`,
     authorize('Admin', 'SuperAdmin'),
     validate(prepareBudgetSchema),
     asyncHandler(analysisController.prepareNextPeriodBudget)
   );

// predict
  router.post(
    `${prefix}/run-single-prediction`,
    authorize('SuperAdmin', 'Admin', 'Technician'),
    validate(singlePredictionSchema),
    asyncHandler(analysisController.runSinglePrediction)
  );

  router.post(
    `${prefix}/run-bulk-predictions`,
    authorize('SuperAdmin'),
    validate(bulkPredictionSchema),
    asyncHandler(analysisController.runBulkPredictions)
  );
// classifation
  router.post(
    `${prefix}/run-single-classification`,
    authorize('Admin', 'SuperAdmin'),
    validate(singlePredictionSchema),
    asyncHandler(analysisController.runSingleClassification)
  );
// efficiency
  router.post(
    `${prefix}/efficiency-target-preview`,
    authorize('Admin', 'SuperAdmin'),
    validate(efficiencyTargetPreviewSchema),
    asyncHandler(analysisController.getEfficiencyTargetPreview)
  );

 
// recap
  router.get(
    `${prefix}/monthly-recap`,
    authorize('Admin', 'SuperAdmin'),
    validate(monthlyRecapSchema),
    asyncHandler(recapController.getMonthlyRecap)
  );
};
