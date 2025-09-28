import bcrypt from 'bcrypt';
import type { Prisma, User } from '../generated/prisma/index.js';
import prisma from '../configs/db.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';
import type { DefaultArgs } from '../generated/prisma/runtime/library.js';
import type { CustomErrorMessages } from '../utils/baseService.js';
import type { GetUsersQuery } from '../types/user.type.js';

type CreateUserInput = {
  username: string;
  password: string;
  role_id: number;
  is_active?: boolean;
  photo_profile_url?: string | null;
};
type UpdateUserInput = Partial<CreateUserInput>;

export class UserService extends GenericBaseService<
  typeof prisma.user,
  User,
  CreateUserInput,
  UpdateUserInput,
  Prisma.UserFindManyArgs,
  Prisma.UserFindUniqueArgs,
  Prisma.UserCreateArgs,
  Prisma.UserUpdateArgs,
  Prisma.UserDeleteArgs
> {
  constructor() {
    super(prisma, prisma.user, 'user_id');
  }

  public override async findAll(query: GetUsersQuery): Promise<User> {
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

    const findArgs: Prisma.UserFindManyArgs = {
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
    };

    return this._model.findMany(findArgs);
  }
  public override async create(data: CreateUserInput): Promise<User> {
    const { password, ...restOfData } = data;

    if (!password) {
      throw new Error('Password is required but was not provided.');
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const args: Prisma.UserCreateArgs = {
      data: {
        ...restOfData,
        password_hash: hashedPassword,
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
    data: UpdateUserInput
  ): Promise<User> {
    const { password, ...restOfData } = data;
    const dataToUpdate: Prisma.UserUpdateInput = { ...restOfData };

    if (password) {
      dataToUpdate.password_hash = await bcrypt.hash(password, 10);
    }

    const args: Omit<Prisma.UserUpdateArgs, 'where'> = {
      data: dataToUpdate,
    };

    return this._update(userId, args);
  }

  /**
   * Method spesifik untuk User: Mencari berdasarkan username.
   */
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
  /**
   * Method spesifik untuk User: Mengambil data dengan paginasi dan filter.
   */
  public async findAllWithPagination(filters: GetUsersQuery) {
    const { role_id, is_active, page, limit, search } = filters;

    const where: Prisma.UserWhereInput = { is_active: true };
    if (search) {
      where.username = { contains: search, mode: 'insensitive' };
    }
    if (role_id) {
      where.role_id = role_id;
    }
    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    const findArgs: Prisma.UserFindManyArgs = {
      where,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        user_id: true,
        username: true,
        is_active: true,
        photo_profile_url: true,
        role: { select: { role_id: true, role_name: true } },
        created_at: true,
      },
      orderBy: { user_id: 'asc' },
    };

    const [total, users] = await this._prisma.$transaction([
      this._model.count({ where }),
      this._model.findMany(findArgs),
    ]);

    return {
      data: users,
      meta: { total, page, limit, last_page: Math.ceil(total / limit) },
    };
  }

  /**
   * Implementasi 'soft delete' dengan memanfaatkan helper '_update'.
   */
  public async softDelete(userId: number): Promise<User> {
    const args: Omit<Prisma.UserUpdateArgs, 'where'> = {
      data: { is_active: false },
    };
    return this._update(userId, args);
  }
}

export const userService = new UserService();
