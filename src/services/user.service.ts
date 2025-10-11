import bcrypt from 'bcrypt';
import type { Prisma, User } from '../generated/prisma/index.js';
import prisma from '../configs/db.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';

import type {
  CreateUserBody,
  GetUsersQuery,
  UpdateUserBody,
} from '../types/user.type.js';
import { Error404 } from '../utils/customError.js';
import type { DefaultArgs } from '../generated/prisma/runtime/library.js';
import type { CustomErrorMessages } from '../utils/baseService.js';

export class UserService extends GenericBaseService<
  typeof prisma.user,
  User,
  CreateUserBody,
  UpdateUserBody,
  Prisma.UserFindManyArgs,
  Prisma.UserFindUniqueArgs,
  Prisma.UserCreateArgs,
  Prisma.UserUpdateArgs,
  Prisma.UserDeleteArgs
> {
  constructor() {
    super(prisma, prisma.user, 'user_id');
  }

  public async findAll(query: GetUsersQuery) {
    const { limit, page, isActive, roleName, search } = query;
    const where: Prisma.UserWhereInput = {};

    // 1. Perbaiki filter 'is_active'
    if (isActive !== undefined) {
      where.is_active = isActive;
    }

    // 2. Perbaiki filter 'role_name'
    if (roleName) {
      where.role = {
        role_name: roleName,
      };
    }

    // 3. Tambahkan fungsionalitas 'search'
    if (search) {
      where.username = {
        contains: search,
        mode: 'insensitive', // Agar tidak case-sensitive (a == A)
      };
    }

    return prisma.user.findMany({
      where,
      // 4. Tambahkan fungsionalitas paginasi (limit & page)
      skip: (page - 1) * limit,
      take: limit,
      include: {
        role: true,
      },
      orderBy: {
        user_id: 'asc',
      },
    });
  }

  public override async findById(id: number): Promise<User> {
    return prisma.user.findUniqueOrThrow({
      where: { user_id: id },
      include: {
        role: true,
        reading_sessions: true,
        events_logbook: true,
        alerts_acknowledged: true,
        efficiency_targets_set: true,
        insights_acknowledged: true,
        notifications: true,
        price_schemes_set: true,
      },
    });
  }

  public override async create(data: CreateUserBody): Promise<User> {
    const { password, roleName, ...restOfData } = data;

    const role = await prisma.role.findUnique({
      where: { role_name: roleName as any }, // Perbaikan cepat, idealnya divalidasi dengan Zod enum
    });
    restOfData.role_id = role.role_id;
    if (!role) {
      throw new Error404('Role not found.');
    }

    if (!password) {
      throw new Error('Password is required but was not provided.');
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const args: Prisma.UserCreateArgs = {
      data: {
        ...restOfData,
        password_hash: hashedPassword,
      },
      select: {
        username: true,
        role: true,
        user_id: true,
        photo_profile_url: true,
        is_active: true,
        created_at: true,
      },
    };

    return this._create(args);
  }

  /**
   * @override
   * Implementasi 'update' dari kontrak abstrak base class.
   */
  public override async update(
    userId: number,
    data: UpdateUserBody
  ): Promise<User> {
    const { password, roleName, ...restOfData } = data;
    const dataToUpdate = { ...restOfData };
    if (roleName) {
      const role_id = await prisma.role.findUnique({
        where: { role_name: roleName as any }, // Perbaikan cepat
        select: { role_id: true },
      });
      dataToUpdate.role_id = role_id?.role_id;
    }
    if (password) {
      dataToUpdate.password_hash = await bcrypt.hash(password, 10);
    }

    const args: Omit<Prisma.UserUpdateArgs, 'where'> = {
      data: dataToUpdate,
      select: {
        username: true,
        role: true,
        user_id: true,
        photo_profile_url: true,
        is_active: true,
        created_at: true,
      },
    };

    return this._update(userId, args);
  }

  // public async findByUsername(username: string): Promise<User | null> {
  //   return prisma.user.findUnique({
  //     where: { username },
  //   });
  // }

  public async findByUsername(
    username: string
  ): Promise<(User & { role: any }) | null> {
    return this._handleCrudOperation(() =>
      this._model.findUnique({
        where: { username },
        include: { role: true },
      })
    );
  }
}

export const userService = new UserService();
