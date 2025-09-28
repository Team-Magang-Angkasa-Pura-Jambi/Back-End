import prisma from '../configs/db.js';
import type {
  $Enums,
  Prisma,
  Role,
  RoleName,
} from '../generated/prisma/index.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';

type CreateRoleInput = {
  role_name: RoleName;
};

type UpdateRoleInput = Partial<CreateRoleInput>;

export class RoleService extends GenericBaseService<
  typeof prisma.role,
  Role,
  CreateRoleInput,
  UpdateRoleInput,
  Prisma.RoleFindManyArgs,
  Prisma.RoleFindUniqueArgs,
  Prisma.RoleCreateArgs,
  Prisma.RoleUpdateArgs,
  Prisma.RoleDeleteArgs
> {
 
  constructor() {
    super(prisma, prisma.role, 'role_id');
  }
}
export const roleService = new RoleService();
