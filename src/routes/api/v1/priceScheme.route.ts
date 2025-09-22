// src/routes/priceScheme.routes.ts

import { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { PriceSchemeService } from '../../../services/priceShcema.service.js';
import { PriceSchemeController } from '../../../controllers/priceSchme.controller.js';
import {
  createPriceSchemeSchema,
  priceSchemeParamsSchema,
  updatePriceSchemeSchema,
} from '../../../validations/priceSchema.validation.js';

export default (router: Router) => {
  const priceSchemeRouter = createCrudRouter('/price-schemes', {
    ServiceClass: PriceSchemeService,
    ControllerClass: PriceSchemeController,
    idParamName: 'scheme_id',
    schemas: {
      create: createPriceSchemeSchema,
      update: updatePriceSchemeSchema,
      params: priceSchemeParamsSchema,
    },
  });

  router.use(priceSchemeRouter);
};
