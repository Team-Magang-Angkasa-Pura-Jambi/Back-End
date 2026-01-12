import type { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { MeterService } from '../../../services/metering/meter.service.js';
import { MeterController } from '../../../controllers/metering/meter.controller.js';
import { meterSchema, queryMeter } from '../../../validations/metering/meter.validation.js';

export const meterRoutes = (router: Router) => {
  const meterRouter = createCrudRouter('/meters', {
    ServiceClass: MeterService,
    ControllerClass: MeterController,
    idParamName: 'meterId',

    schemas: {
      getAll: queryMeter,
      create: meterSchema.create,
      update: meterSchema.update,
      params: meterSchema.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin', 'Technician'],
      getById: ['Admin', 'SuperAdmin', 'Technician'],
      create: ['SuperAdmin', 'Admin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin', 'Admin'],
    },
  });

  router.use(meterRouter);
};
