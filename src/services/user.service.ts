import prisma from '../configs/db.js';
import type { Prisma, User } from '../generated/prisma/index.js';
import {
  Error400,
  Error404,
  Error409,
  Error500,
} from '../utils/customError.js';
import { isPrismaError } from '../utils/PrismaError.js';

import bcrypt from 'bcrypt';
import type { GetUsersQuery } from '../validations/user.validation.js';
import type { CreateUserBody, UpdateUserBody } from '../types/auth.type.js';

export class UserService {
  public async findAll(filters: GetUsersQuery) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const { search, role_id } = filters;

    const skip = (page - 1) * limit;
    const take = limit;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.username = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (role_id) {
      where.role = {
        role_id: role_id,
      };
    }

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          user_id: true,
          username: true,
          is_active: true,
          role: {
            select: {
              role_id: true,
              role_name: true,
            },
          },
          created_at: true,
        },
        orderBy: {
          user_id: 'asc',
        },
      }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        last_page: Math.ceil(total / limit),
      },
    };
  }

  public async findAllActive(filters: GetUsersQuery) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const { search, role_id } = filters;

    const skip = (page - 1) * limit;
    const take = limit;

    const where: Prisma.UserWhereInput = {};

    where.is_active = true;

    if (search) {
      where.username = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (role_id) {
      where.role = {
        role_id: role_id,
      };
    }

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          user_id: true,
          username: true,
          is_active: true,
          role: {
            select: {
              role_id: true,
              role_name: true,
            },
          },
          created_at: true,
        },
        orderBy: {
          user_id: 'asc',
        },
      }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        last_page: Math.ceil(total / limit),
      },
    };
  }
  public async findById(userId: number) {
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { user_id: true, username: true, role: true },
    });

    if (!user) {
      throw new Error404(`Pengguna ${userId} tidak ditemukan.`);
    }
    return user;
  }

  public async findByUsername(username: string) {
    return prisma.user.findUnique({
      where: { username },
      include: {
        role: true,
      },
    });
  }

  public async create(userData: CreateUserBody) {
    const { username, password, role_id } = userData;

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await prisma.user.create({
        data: {
          username,
          password_hash: hashedPassword,
          role_id: role_id ?? 2,
        },
        select: { user_id: true, username: true, created_at: true },
      });
      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      if (isPrismaError(error, 'P2002')) {
        throw new Error409(`Username '${username}' sudah digunakan.`);
      }
      throw new Error500('Gagal membuat pengguna karena kesalahan server.');
    }
  }

  public async update(
    userId: number,
    userData: UpdateUserBody
  ): Promise<Omit<User, 'password_hash'>> {
    const { username, password, role_id } = userData;

    const dataToUpdate: Prisma.UserUpdateInput = {};

    if (username) {
      dataToUpdate.username = username;
    }

    if (password) {
      dataToUpdate.password_hash = await bcrypt.hash(password, 10);
    }

    if (role_id) {
      dataToUpdate.role = {
        connect: {
          role_id: role_id,
        },
      };
    }

    if (Object.keys(dataToUpdate).length === 0) {
      throw new Error400('Tidak ada data yang dikirim untuk diupdate.');
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { user_id: userId },

        data: dataToUpdate,

        select: {
          user_id: true,
          username: true,
          role_id: true,
          is_active: true,
          created_at: true,
          updatedAt: true,
        },
      });
      return updatedUser;
    } catch (error) {
      console.error(`Error updating user with ID ${userId}:`, error);

      if (isPrismaError(error, 'P2025')) {
        throw new Error404(`Pengguna dengan ID '${userId}' tidak ditemukan.`);
      }

      if (isPrismaError(error, 'P2002')) {
        throw new Error409(`Username '${username}' sudah digunakan.`);
      }

      throw new Error500('Gagal mengupdate pengguna karena kesalahan server.');
    }
  }

  public async delete(userId: number): Promise<Omit<User, 'password_hash'>> {
    try {
      return prisma.user.update({
        where: {
          user_id: userId,
        },
        data: {
          is_active: false,
        },
      });
    } catch (error) {
      console.error(`Error deleting user with ID ${userId}:`, error);
      if (isPrismaError(error, 'P2025')) {
        throw new Error404(`Pengguna dengan ID '${userId}' tidak ditemukan.`);
      }
      throw new Error500('Gagal menghapus pengguna karena kesalahan server.');
    }
  }
}

export const userService = new UserService();
