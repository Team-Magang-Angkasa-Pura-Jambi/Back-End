import type { Router } from 'express';
import { energyTypeSchema, queryEnergy } from '../../../validations/metering/energy.validation.js';

import { createCrudRouter } from '../../../utils/routerFactory.js';
import { EnergyTypeService } from '../../../services/metering/energy.service.js';
import { EnergyTypeController } from '../../../controllers/metering/energy.controller.js';

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
      create: ['SuperAdmin', 'Admin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin', 'Admin'],
    },
  });

  router.use(energyTypeRouter);
};
