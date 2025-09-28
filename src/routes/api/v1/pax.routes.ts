import type { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { paxService } from '../../../services/pax.service.js';
import { PaxController } from '../../../controllers/pax.controller.js';
import { paxScheme } from '../../../validations/paxData.validation.js';

export default (router: Router) => {
  const paxRouter = createCrudRouter('/pax', {
    ServiceClass: paxService,
    ControllerClass: PaxController,
    idParamName: 'paxId',

    schemas: {
      getAll: paxScheme.listQuery,
      create: paxScheme.create,
      update: paxScheme.update,
      params: paxScheme.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['Technician', 'Admin', 'SuperAdmin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin'],
    },
  });

  router.use(paxRouter);
};
