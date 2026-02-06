// src/routes/efficiencyTarget.routes.ts

import { type Router } from 'express';

import { createCrudRouter } from '../../../utils/routerFactory.js';
import { EfficiencyTargetService } from '../../../services/intelligence/efficiencyTarget.service.js';
import {
  EfficiencyTargetController,
  efficiencyTargetController,
} from '../../../controllers/intelligence/efficiencyTarget.controller.js';
import {
  efficiencyScheme,
  efficiencyTargetPreviewSchema,
} from '../../../validations/intelligence/efficiencyTargets.validation.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export default (router: Router) => {
  const prefix = '/efficiency';
  // Gunakan pabrik untuk membuat semua rute CRUD secara otomatis
  const efficiencyTargetRouter = createCrudRouter(prefix, {
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

  router.post(
    `${prefix}/preview`,
    authorize('Admin', 'SuperAdmin'),
    validate(efficiencyTargetPreviewSchema),
    asyncHandler(efficiencyTargetController.getEfficiencyTargetPreview),
  );
};
