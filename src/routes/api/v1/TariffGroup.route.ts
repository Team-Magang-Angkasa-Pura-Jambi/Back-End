import type { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { TariffGroupService } from '../../../services/finance/TariffGroup.service.js';
import {
  tariffGroupController,
  TariffGroupController,
} from '../../../controllers/finance/TariffGroup.controller.js';
import {
  paramsTariffGroup,
  tariffGroupSchemas,
} from '../../../validations/finance/TariffGroup.validation.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export default (router: Router) => {
  const prefix = '/tariff-groups';

  const tariffGroupRouter = createCrudRouter(prefix, {
    ServiceClass: TariffGroupService,
    ControllerClass: TariffGroupController,
    idParamName: 'tariffGroupId',

    schemas: {
      getAll: tariffGroupSchemas.listQuery,
      create: tariffGroupSchemas.create,
      update: tariffGroupSchemas.update,
      params: tariffGroupSchemas.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['SuperAdmin', 'Admin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin', 'Admin'],
    },
  });
  router.get(
    prefix + '/types',
    validate(paramsTariffGroup),
    asyncHandler(tariffGroupController.findByType),
  );
  router.use(tariffGroupRouter);
};
