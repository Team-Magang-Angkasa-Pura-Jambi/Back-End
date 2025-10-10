import { RoleService, roleService } from '../services/role.service.js';
import { BaseController } from '../utils/baseController.js';
import type { Role } from '../generated/prisma/index.js';
import type {
  CreateRoleBody,
  GetRolesQuery,
  UpdateRoleBody,
} from '../types/role.type.js';

/**
 * Controller untuk menangani request HTTP terkait Peran.
 */
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
