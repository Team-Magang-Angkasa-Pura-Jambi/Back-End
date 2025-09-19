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
import { BaseService } from '../utils/baseService.js';

export class UserService extends BaseService {
  public async findAll(filters: GetUsersQuery & { is_active?: boolean }) {
    const { page = 1, limit = 10, search, role_id, is_active } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      // Secara default, filter is_active jika tidak ditentukan secara eksplisit
      is_active: is_active === undefined ? true : is_active,
    };

    if (search) {
      where.username = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (role_id) {
      where.role_id = role_id;
    }

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
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
          updatedAt: true,
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
    const user = await prisma.user.findFirst({
      where: { user_id: userId, is_active: true },
      select: {
        user_id: true,
        username: true,
        is_active: true,
        role: true,
        created_at: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error404(`Pengguna dengan ID ${userId} tidak ditemukan.`);
    }
    return user;
  }

  /**
   * Menemukan satu pengguna berdasarkan username-nya (termasuk yang tidak aktif, untuk login).
   */
  public async findByUsername(username: string) {
    return prisma.user.findUnique({
      where: { username },
      include: {
        role: true,
      },
    });
  }

  /**
   * Membuat pengguna baru.
   */
  public async create(data: CreateUserBody) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    return this._handleCrudOperation(
      () =>
        prisma.user.create({
          data: {
            username: data.username,
            password_hash: hashedPassword,
            role_id: data.role_id,
          },
          select: {
            user_id: true,
            username: true,
            is_active: true,
            role: true,
          },
        }),
      {
        P2002: `Username '${data.username}' sudah terdaftar.`,
      }
    );
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

    return this._handleCrudOperation(
      () =>
        prisma.user.update({
          where: { user_id: userId },

          data: dataToUpdate,

          select: {
            user_id: true,
            username: true,
            role_id: true,
            is_active: true,
            created_at: true,
            updatedAt: true,
            photo_profile_url: true,
          },
        }),
      {
        P2025: `Username '${username}' sudah digunakan.`,
        P2002: `Pengguna dengan ID '${userId}' tidak ditemukan.`,
      }
    );
  }

  public async softDelete(userId: number) {
    await this.findById(userId); // Pastikan user ada dan aktif
    return prisma.user.update({
      where: { user_id: userId },
      data: { is_active: false },
      select: { user_id: true, username: true, is_active: true },
    });
  }

  /**
   * Melakukan Hard Delete pada pengguna.
   */
  public async deletePermanent(userId: number) {
    // Tidak perlu findById, karena P2025 akan ditangani oleh wrapper
    return this._handleCrudOperation(
      () =>
        prisma.user.delete({
          where: { user_id: userId },
        }),
      {
        P2003:
          'Pengguna ini tidak dapat dihapus permanen karena masih memiliki data terkait.',
      }
    );
  }
}

export const userService = new UserService();
