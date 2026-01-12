import prisma from '../../configs/db.js';
import type { $Enums, Prisma, Role, RoleName } from '../../generated/prisma/index.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';

interface CreateRoleInput {
  role_name: RoleName;
}

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

  public findById(id: number): Promise<{ role_id: number; role_name: $Enums.RoleName }> {
    return this._handleCrudOperation(() =>
      this._model.findUniqueOrThrow({
        where: { role_id: id },
        include: {
          users: true,
          _count: true,
        },
      }),
    );
  }
}
export const roleService = new RoleService();
