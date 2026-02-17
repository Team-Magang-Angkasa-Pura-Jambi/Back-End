import prisma from '../../configs/db.js';
import { RoleType, type Prisma } from '../../generated/prisma/index.js';
import { type RolesPayload } from './roles.type.js';

interface RoleQuery {
  role_name?: RoleType;
}

export const rolesService = {
  store: (payload: RolesPayload) => {
    return prisma.role.create({
      data: payload,
      select: { role_id: true, role_name: true },
    });
  },

  list: async (query?: { role_name?: string }) => {
    const whereClause: Prisma.RoleWhereInput = {};

    if (query?.role_name) {
      const roleInput = query.role_name.toUpperCase();

      if (Object.values(RoleType).includes(roleInput as RoleType)) {
        whereClause.role_name = roleInput as RoleType;
      } else {
        return [];
      }
    }

    return prisma.role.findMany({
      where: whereClause,
      select: { role_id: true, role_name: true },
    });
  },
};
