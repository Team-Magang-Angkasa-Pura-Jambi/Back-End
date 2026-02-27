import { handlePrismaError } from '../../common/utils/prismaError.js';
import { deleteFileFromUT } from '../../common/utils/uploadthing.js';
import prisma from '../../configs/db.js';
import { RoleType, type Prisma } from '../../generated/prisma/index.js';
import { Error404 } from '../../utils/customError.js';
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
        role: { select: { role_id: true, role_name: true } },
      },
    });
  },

  patch: async (user_id: number, payload: UpdateUserPayload) => {
    try {
      const oldUser = await prisma.user.findUnique({
        where: { user_id },
      });

      if (!oldUser) throw new Error404('User Tidak Ditemukan');

      const { password, ...dataToUpdate }: any = payload;

      if (payload.image_url && oldUser.image_url && oldUser.image_url !== payload.image_url) {
        await deleteFileFromUT(oldUser.image_url);
      }

      if (password) {
        dataToUpdate.password_hash = await bcrypt.hash(password, 10);
      }

      return await prisma.user.update({
        where: { user_id },
        data: dataToUpdate,
        select: {
          user_id: true,
          full_name: true,
          username: true,
          email: true,
          image_url: true,
          is_active: true,
          role: {
            select: {
              role_name: true,
            },
          },
        },
      });
    } catch (error) {
      return handlePrismaError(error, 'User');
    }
  },

  remove: async (id: number) => {
    try {
      return await prisma.user.delete({
        where: { user_id: id },
        select: {
          user_id: true,
          full_name: true,
        },
      });
    } catch (error) {
      return handlePrismaError(error, 'User');
    }
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
          created_at: true,
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
        created_at: true,
        role: {
          select: { role_name: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  },
};
