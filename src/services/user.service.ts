import bcrypt from 'bcrypt';
import type { Prisma, User } from '../generated/prisma/index.js';
import prisma from '../configs/db.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';

// Tipe data input untuk UserService, biasanya didapat dari z.infer<schema>
type GetUsersQuery = {
  page: number;
  limit: number;
  search?: string;
  role_id?: number;
  is_active?: boolean;
};
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

  /**
   * @override
   * Implementasi 'create' dari kontrak abstrak base class.
   */
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
    console.log(filters);

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
