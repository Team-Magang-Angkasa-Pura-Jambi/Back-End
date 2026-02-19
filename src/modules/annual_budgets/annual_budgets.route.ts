// Generated for Sentinel Projectimport { Router } from 'express';
import { type Router } from 'express';
import { budgetController } from './annual_budgets.controller.js';
import { validate } from '../../utils/validate.js';
import { budgetSchema } from './annual_budgets.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const budgetRoute = (router: Router) => {
  const prefix = '/annual-budgets';

  router.get(prefix, validate(budgetSchema.show), asyncHandler(budgetController.show));
  router.get(`${prefix}/:id`, validate(budgetSchema.show), asyncHandler(budgetController.show));
  router.post(prefix, validate(budgetSchema.store), asyncHandler(budgetController.store));
  router.patch(
    `${prefix}/:id`,
    validate(budgetSchema.patch),
    asyncHandler(budgetController.update),
  );
  router.delete(
    `${prefix}/:id`,
    validate(budgetSchema.remove),
    asyncHandler(budgetController.remove),
  );
};
