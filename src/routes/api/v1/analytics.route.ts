import { type Router } from 'express';
import { authorize } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { analysisController } from '../../../controllers/report/analysis.controller.js';
import {
  budgetAllocationQuerySchema,
  budgetPreviewSchema,
  efficiencyTargetPreviewSchema,
  fuelStockAnalysisQuerySchema,
  getBudgetSummarySchema,
  prepareBudgetSchema,
  todaySummaryQuerySchema,
} from '../../../validations/reports/analysis.validation.js';

export default (router: Router) => {
  const prefix = '/analytics';

  router.get(
    `${prefix}/fuel-stock`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(fuelStockAnalysisQuerySchema),
    asyncHandler(analysisController.getMonthlyFuelStockAnalysis),
  );

  router.get(
    `${prefix}/today-summary`,
    authorize('Technician', 'Admin', 'SuperAdmin'),
    validate(todaySummaryQuerySchema),
    asyncHandler(analysisController.getTodaySummary),
  );
  // budget
  router.get(
    `${prefix}/budget-allocation`,
    authorize('Admin', 'SuperAdmin'),
    validate(budgetAllocationQuerySchema),
    asyncHandler(analysisController.getBudgetAllocation),
  );

  router.post(
    `${prefix}/budget-preview`,
    authorize('Admin', 'SuperAdmin'),
    validate(budgetPreviewSchema),
    asyncHandler(analysisController.getBudgetPreview),
  );

  router.get(
    `${prefix}/budget-summary`,
    authorize('Admin', 'SuperAdmin'),
    validate(getBudgetSummarySchema),
    asyncHandler(analysisController.getBudgetSummary),
  );

  router.get(
    `${prefix}/prepare-budget/:parentBudgetId`,
    authorize('Admin', 'SuperAdmin'),
    validate(prepareBudgetSchema),
    asyncHandler(analysisController.prepareNextPeriodBudget),
  );

  // efficiency
  router.post(
    `${prefix}/efficiency-target-preview`,
    authorize('Admin', 'SuperAdmin'),
    validate(efficiencyTargetPreviewSchema),
    asyncHandler(analysisController.getEfficiencyTargetPreview),
  );
};
