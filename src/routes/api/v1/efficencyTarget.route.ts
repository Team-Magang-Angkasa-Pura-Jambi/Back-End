// src/routes/efficiencyTarget.routes.ts

import { Router } from 'express';

import { createCrudRouter } from '../../../utils/routerFactory.js';
import { EfficiencyTargetService } from '../../../services/efficiencyTarget.service.js';
import { EfficiencyTargetController } from '../../../controllers/efficiencyTarget.controller.js';
import { efficiencyScheme } from '../../../validations/efficiencyTargets.validation.js';

export default (router: Router) => {
  // Gunakan pabrik untuk membuat semua rute CRUD secara otomatis
  const efficiencyTargetRouter = createCrudRouter('/efficiency-targets', {
    ServiceClass: EfficiencyTargetService,
    ControllerClass: EfficiencyTargetController,
    idParamName: 'targetId',
    schemas: {
      getAll: efficiencyScheme.listQuery,
      create: efficiencyScheme.create,
      update: efficiencyScheme.update,
      params: efficiencyScheme.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['SuperAdmin', 'Admin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin', 'Admin'],
    },
  });

  router.use(efficiencyTargetRouter);
};
