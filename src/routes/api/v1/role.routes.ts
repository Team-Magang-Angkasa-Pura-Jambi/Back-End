import type { Router } from 'express';
import { createCrudRouter } from '../../../utils/routerFactory.js';
import { roleSchemas } from '../../../validations/role.validation.js';
import { RoleService } from '../../../services/role.service.js';
import { RoleController } from '../../../controllers/role.controller.js';

export const roleRoutes = (router: Router) => {
  const roleRouter = createCrudRouter('/roles', {
    ServiceClass: RoleService,
    ControllerClass: RoleController,
    idParamName: 'roleId',

    schemas: {
      getAll: roleSchemas.listQuery,
      create: roleSchemas.create,
      update: roleSchemas.update,
      params: roleSchemas.byId,
    },

    authorizations: {
      getAll: ['Admin', 'SuperAdmin'],
      getById: ['Admin', 'SuperAdmin'],
      create: ['SuperAdmin'],
      update: ['Admin', 'SuperAdmin'],
      delete: ['SuperAdmin'],
    },
  });
  router.use(roleRouter);
};
