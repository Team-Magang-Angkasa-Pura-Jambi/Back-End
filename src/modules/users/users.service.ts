import prisma from '../../configs/db.js';
import { RoleType, type Prisma } from '../../generated/prisma/index.js';
import { type UpdateUserPayload, type UserBodyPayload } from './users.schema.js';
import bcrypt from 'bcrypt';

export const usersService = {
  store: async (payload: UserBodyPayload) => {
    const { password, ...userData } = payload;
    const password_hash = await bcrypt.hash(password, 10);

    return await prisma.user.create({
      data: {
        ...userData,
        password_hash,
      },
      select: {
        user_id: true,
        full_name: true,
        role: { select: { role_name: true } },
      },
    });
  },

  patch: async (user_id: number, payload: UpdateUserPayload) => {
    const dataToUpdate: any = { ...payload };

    if (payload.password) {
      dataToUpdate.password_hash = await bcrypt.hash(payload.password, 10);
      delete dataToUpdate.password;
    }

    return await prisma.user.update({
      where: { user_id },
      data: dataToUpdate,
      select: {
        user_id: true,
        full_name: true,
        role: { select: { role_name: true } },
      },
    });
  },

  remove: async (id: number) => {
    return await prisma.user.delete({
      where: { user_id: id },
      select: {
        user_id: true,
        full_name: true,
      },
    });
  },

  show: async (
    id?: number,
    query?: { full_name?: string; username?: string; role_name?: string },
  ) => {
    if (id) {
      return await prisma.user.findUnique({
        where: { user_id: id },
        select: {
          user_id: true,
          full_name: true,
          username: true,
          email: true,
          image_url: true,
          is_active: true,
          role: {
            select: { role_name: true },
          },

          audit_logs: {
            take: 10,
            orderBy: { created_at: 'desc' },
          },
        },
      });
    }

    const whereClause: Prisma.UserWhereInput = {};

    if (query?.username) {
      whereClause.username = { contains: query.username, mode: 'insensitive' };
    }
    if (query?.full_name) {
      whereClause.full_name = { contains: query.full_name, mode: 'insensitive' };
    }

    if (query?.role_name) {
      const roleInput = query.role_name.toUpperCase();
      if (Object.values(RoleType).includes(roleInput as RoleType)) {
        whereClause.role = {
          role_name: roleInput as RoleType,
        };
      } else {
        return [];
      }
    }

    return await prisma.user.findMany({
      where: whereClause,
      select: {
        user_id: true,
        full_name: true,
        username: true,
        role: {
          select: { role_name: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  },
};
