import type { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { TaxService } from '../../../services/tax.service.js';
import { TaxController } from '../../../controllers/tax.controller.js';
import { taxSchema } from '../../../validations/tax.validation.js';

export default (router: Router) => {
  const taxRouter = createCrudRouter('/tax', {
    ServiceClass: TaxService,
    ControllerClass: TaxController,
    idParamName: 'taxId',

    schemas: {
      getAll: taxSchema.listQuery,
      create: taxSchema.create,
      update: taxSchema.update,
      params: taxSchema.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['SuperAdmin', 'Admin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin', 'Admin'],
    },
  });

  router.use(taxRouter);
};
