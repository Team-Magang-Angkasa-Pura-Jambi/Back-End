import { type RoleService, roleService } from '../../services/auth/role.service.js';
import { BaseController } from '../../utils/baseController.js';
import type { Role } from '../../generated/prisma/index.js';
import type { CreateRoleBody, GetRolesQuery, UpdateRoleBody } from '../../types/auth/role.type.js';

export class RoleController extends BaseController<
  Role,
  CreateRoleBody,
  UpdateRoleBody,
  GetRolesQuery,
  RoleService
> {
  constructor() {
    super(roleService, 'roleId');
  }
}
