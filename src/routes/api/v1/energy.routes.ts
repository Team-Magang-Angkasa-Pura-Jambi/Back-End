import type { Router } from 'express';
import {
  energyTypeSchema,
  queryEnergy,
} from '../../../validations/energy.validation.js';

import { createCrudRouter } from '../../../utils/routerFactory.js';
import { EnergyTypeService } from '../../../services/energy.service.js';
import { EnergyTypeController } from '../../../controllers/energy.controller.js';

export const energyTypeRoutes = (router: Router) => {
  const energyTypeRouter = createCrudRouter('/energy-types', {
    ServiceClass: EnergyTypeService,
    ControllerClass: EnergyTypeController,
    idParamName: 'energyTypeId',

    schemas: {
      getAll: queryEnergy,
      create: energyTypeSchema.create,
      update: energyTypeSchema.update,
      params: energyTypeSchema.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin', 'Technician'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['SuperAdmin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin'],
    },
  });

  router.use(energyTypeRouter);
};
