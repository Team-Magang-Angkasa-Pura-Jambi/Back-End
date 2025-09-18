import type { Router } from 'express';
import { RoleService } from '../../../services/role.service.js';
import { roleController, RoleController } from '../../../controllers/role.controller.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { validate } from '../../../utils/validate.js';
import {
  createRoleSchema,
  updateRoleSchema,
} from '../../../validations/role.validation.js';

export const roleRoutes = (router: Router) => {
  const prefix = '/roles';

  // Endpoint untuk mengambil semua dan membuat peran
  // PERHATIAN: Sebaiknya endpoint POST, PUT, DELETE hanya untuk SuperAdmin
  router
    .route(prefix)
    .get(asyncHandler(roleController.getAllRoles))
    .post(validate(createRoleSchema), asyncHandler(roleController.createRole));

  // Endpoint untuk operasi pada satu peran by ID
  router
    .route(`${prefix}/:id`)
    .get(asyncHandler(roleController.getRoleById))
    .put(validate(updateRoleSchema), asyncHandler(roleController.updateRole))
    .delete(asyncHandler(roleController.deleteRole));
};
