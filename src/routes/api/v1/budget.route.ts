import { type Router } from 'express';
import { budgetController } from '../../../controllers/finance/budget.controller.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import { z } from 'zod';
import { validate } from '../../../utils/validate.js';
import {
  budgetPreviewSchema,
  getBudgetSummarySchema,
  prepareBudgetSchema,
} from '../../../validations/reports/budget.validations.js';

// BARU: Skema validasi untuk body request
const processBudgetSchema = z.object({
  body: z.object({
    pjj_rate: z.coerce.number().min(0).max(1),
    process_date: z.string().date('Format tanggal tidak valid.').optional(),
  }),
});

const prefix = '/budgets';

export default (router: Router) => {
  router.post(
    `${prefix}/preview`,
    authorize('Admin', 'SuperAdmin'),
    validate(budgetPreviewSchema),
    asyncHandler(budgetController.getBudgetPreview),
  );

  router.get(
    `${prefix}/summary`,
    authorize('Admin', 'SuperAdmin'),
    validate(getBudgetSummarySchema),
    asyncHandler(budgetController.getBudgetSummary),
  );

  router.get(
    `${prefix}/prepare/:parentBudgetId`,
    authorize('Admin', 'SuperAdmin'),
    validate(prepareBudgetSchema),
    asyncHandler(budgetController.prepareNextPeriodBudget),
  );
};
