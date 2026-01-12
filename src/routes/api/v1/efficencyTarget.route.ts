// src/routes/efficiencyTarget.routes.ts

import { type Router } from 'express';

import { createCrudRouter } from '../../../utils/routerFactory.js';
import { EfficiencyTargetService } from '../../../services/intelligence/efficiencyTarget.service.js';
import { EfficiencyTargetController } from '../../../controllers/intelligence/efficiencyTarget.controller.js';
import { efficiencyScheme } from '../../../validations/intelligence/efficiencyTargets.validation.js';

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
