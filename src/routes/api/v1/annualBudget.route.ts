import { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { AnnualBudgetService } from '../../../services/annualBudget.service.js';
import {
  annualBudgetController,
  AnnualBudgetController,
} from '../../../controllers/annualBudget.controller.js';
import {
  annualBudgetSchema,
  queryAnnualBudget,
} from '../../../validations/annualBudget.validation.js';
import { RoleName } from '../../../generated/prisma/index.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { authorize } from '../../../middleware/auth.middleware.js';

export default (router: Router) => {
  const annualBudgetRouter = createCrudRouter('/annual-budgets', {
    ServiceClass: AnnualBudgetService,
    ControllerClass: AnnualBudgetController,
    idParamName: 'budgetId',
    schemas: {
      create: annualBudgetSchema.create,
      update: annualBudgetSchema.update,
      params: annualBudgetSchema.byId,
      getAll: queryAnnualBudget,
    },
    authorizations: {
      getAll: [RoleName.SuperAdmin, RoleName.Admin],
      getById: [RoleName.SuperAdmin, RoleName.Admin],
      create: [RoleName.SuperAdmin, RoleName.Admin],
      update: [RoleName.SuperAdmin, RoleName.Admin],
      delete: [RoleName.SuperAdmin, RoleName.Admin],
    },
  });

  // PERBAIKAN: Daftarkan rute kustom secara terpisah agar tidak menimpa rute CRUD.
  router.get(
    '/annual-budgets/parents',
    authorize('Admin', 'SuperAdmin'),
    validate(queryAnnualBudget),
    asyncHandler(annualBudgetController.getAllParents)
  );

  router.use(annualBudgetRouter);
};
