import { type Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { AnnualBudgetService } from '../../../services/finance/annualBudget.service.js';
import {
  annualBudgetController,
  AnnualBudgetController,
} from '../../../controllers/finance/annualBudget.controller.js';
import {
  annualBudgetSchema,
  getAnnualBudgetSchema,
} from '../../../validations/finance/annualBudget.validation.js';
import { RoleName } from '../../../generated/prisma/index.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { authorize } from '../../../middleware/auth.middleware.js';

export default (router: Router) => {
  const prefix = '/annual-budgets';
  const annualBudgetRouter = createCrudRouter(prefix, {
    ServiceClass: AnnualBudgetService,
    ControllerClass: AnnualBudgetController,
    idParamName: 'budgetId',
    schemas: {
      create: annualBudgetSchema.create,
      update: annualBudgetSchema.update,
      params: annualBudgetSchema.byId,
      getAll: getAnnualBudgetSchema,
    },
    authorizations: {
      getAll: [RoleName.SuperAdmin, RoleName.Admin],
      getById: [RoleName.SuperAdmin, RoleName.Admin],
      create: [RoleName.SuperAdmin, RoleName.Admin],
      update: [RoleName.SuperAdmin, RoleName.Admin],
      delete: [RoleName.SuperAdmin, RoleName.Admin],
    },
  });

  router.get(
    prefix + '/parents',
    authorize('Admin', 'SuperAdmin'),

    asyncHandler(annualBudgetController.getAllParents),
  );

  router.get(
    prefix + '/year-options',
    authorize('Admin', 'SuperAdmin'),
    asyncHandler(annualBudgetController.getYearsOptions),
  );
  router.use(annualBudgetRouter);
};
