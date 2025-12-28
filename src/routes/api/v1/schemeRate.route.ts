import type { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { UserService } from '../../../services/auth/user.service.js';
import { UserController } from '../../../controllers/auth/user.controller.js';
import { userSchemas } from '../../../validations/auth/user.validation.js';
import { SchemeRateService } from '../../../services/finance/SchemeRate.service.js';
import { SchemeRateController } from '../../../controllers/finance/SchemeRate.controller.js';
import { schemaRateSchemas } from '../../../validations/finance/SchemeRate.validation.js';

export default (router: Router) => {
  const schemeRateRouter = createCrudRouter('/scheme-rate', {
    ServiceClass: SchemeRateService,
    ControllerClass: SchemeRateController,
    idParamName: 'rateId',

    schemas: {
      getAll: schemaRateSchemas.listQuery,
      create: schemaRateSchemas.create,
      update: schemaRateSchemas.update,
      params: schemaRateSchemas.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['SuperAdmin', 'Admin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin', 'Admin'],
    },
  });

  router.use(schemeRateRouter);
};
