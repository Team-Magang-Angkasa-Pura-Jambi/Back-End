// src/routes/priceScheme.routes.ts

import { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { PriceSchemeService } from '../../../services/priceShcema.service.js';
import {
  priceSchema,
  queryPriceSchema,
} from '../../../validations/priceSchema.validation.js';
import { PriceSchemeController } from '../../../controllers/priceSchme.controller.js';

export default (router: Router) => {
  const priceSchemeRouter = createCrudRouter('/price-schemes', {
    ServiceClass: PriceSchemeService,
    ControllerClass: PriceSchemeController,
    idParamName: 'schemeId',

    schemas: {
      getAll: queryPriceSchema,
      create: priceSchema.create,
      update: priceSchema.update,
      params: priceSchema.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['SuperAdmin', 'Admin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin','Admin'],
    },
  });

  router.use(priceSchemeRouter);
};
