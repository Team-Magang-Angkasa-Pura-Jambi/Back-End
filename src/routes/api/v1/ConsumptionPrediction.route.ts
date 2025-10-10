import type { Router } from 'express';
import {
  energyTypeSchema,
  queryEnergy,
} from '../../../validations/energy.validation.js';

import { createCrudRouter } from '../../../utils/routerFactory.js';
import { EnergyTypeService } from '../../../services/energy.service.js';
import { EnergyTypeController } from '../../../controllers/energy.controller.js';
import { ConsumptionPredictionService } from '../../../services/ConsumptionPrediction.service.js';
import { ConsumptionPredictionController } from '../../../controllers/consumptionPrediction.controller.js';
import { ConsumptionPredictionSchema } from '../../../validations/ConsumptionPrediction.validation.js';

export const ConsumptionPredictionRoutes = (router: Router) => {
  const ConsumptionPredictionRouter = createCrudRouter(
    '/consumption-prediction',
    {
      ServiceClass: ConsumptionPredictionService,
      ControllerClass: ConsumptionPredictionController,
      idParamName: 'predictionId',

      schemas: {
        getAll: ConsumptionPredictionSchema.listQuery,
        create: ConsumptionPredictionSchema.create,
        update: ConsumptionPredictionSchema.update,
        params: ConsumptionPredictionSchema.byId,
      },

      authorizations: {
        getAll: ['Admin', 'SuperAdmin', 'Technician'],
        getById: ['Admin', 'SuperAdmin'],
        create: ['SuperAdmin'],
        update: ['Admin', 'SuperAdmin'],
        delete: ['SuperAdmin'],
      },
    }
  );

  router.use(ConsumptionPredictionRouter);
};
