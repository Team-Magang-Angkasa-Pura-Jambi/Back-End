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

  public override async findAll(
    query: GetUsersQuery
  ): Promise<Prisma.UserGetPayload<{ include: { role: true } }>[]> {
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

  public override async findById(
    id: number,
    args?: Omit<Prisma.UserFindUniqueArgs<DefaultArgs>, 'where'> | undefined,
    customMessages?: CustomErrorMessages
  ): Promise<User> {
    const findArgs = {
      ...args,
      include: {
        role: true,
        // Relasi lain bisa ditambahkan di sini jika diperlukan untuk detail dasar
      },
    };
    return this._model.findUniqueOrThrow({
      where: { user_id: id },
      ...findArgs,
    });
  }

  /**
   * BARU: Mengambil dan menyatukan riwayat aktivitas pengguna dari berbagai sumber.
   * @param userId - ID pengguna yang akan dicari riwayatnya.
   * @returns Objek pengguna beserta array 'history' yang terstruktur.
   */
  public async getActivityHistory(userId: number) {
    // Tentukan batas waktu 7 hari yang lalu
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Ambil semua data pengguna beserta relasi aktivitasnya.
    const userWithRelations = await this._model.findUniqueOrThrow({
      where: { user_id: userId },
      // Omit password_hash from the result for security
      include: {
        // Aktivitas pencatatan meter
        reading_sessions: {
          where: {
            created_at: { gte: sevenDaysAgo }, // Filter 7 hari terakhir
          },
          include: {
            meter: { select: { meter_code: true, energy_type: true } },
          },
          orderBy: { created_at: 'desc' },
        },
        // Aktivitas pengaturan skema harga
        price_schemes_set: {
          where: {
            effective_date: { gte: sevenDaysAgo }, // PERBAIKAN: Gunakan 'effective_date'
          },
          include: { tariff_group: { select: { group_name: true } } },
          orderBy: { effective_date: 'desc' },
        },
        // Aktivitas pengaturan target efisiensi
        efficiency_targets_set: {
          where: {
            period_start: { gte: sevenDaysAgo }, // PERBAIKAN: Gunakan 'period_start'
          },
          include: { meter: { select: { meter_code: true } } },
          orderBy: { period_start: 'desc' },
        },
      },
    });

    // 2. Ubah setiap jenis aktivitas menjadi format yang seragam.
    const readingHistory = userWithRelations.reading_sessions.map(
      (session) => ({
        type: 'Pencatatan Meter',
        timestamp: session.created_at,
        description: `Melakukan pencatatan untuk meter ${
          session.meter.meter_code
        } (${session.meter.energy_type.type_name}).`,
        details: session,
      })
    );

    const priceSchemeHistory = userWithRelations.price_schemes_set.map(
      (scheme) => ({
        type: 'Pengaturan Harga',
        timestamp: scheme.effective_date,
        description: `Mengatur skema harga baru "${scheme.scheme_name}" untuk golongan tarif ${scheme.tariff_group.group_name}.`,
        details: scheme,
      })
    );

    // BARU: Tambahkan pemetaan untuk target efisiensi
    const efficiencyTargetHistory =
      userWithRelations.efficiency_targets_set.map((target) => ({
        type: 'Pengaturan Target',
        timestamp: target.period_start, // PERBAIKAN: Gunakan 'period_start' sebagai timestamp
        description: `Mengatur target "${target.kpi_name}" untuk meter ${target.meter.meter_code}.`,
        details: target,
      }));

    // 3. Gabungkan semua riwayat dan urutkan dari yang terbaru.
    const fullHistory = [
      ...readingHistory,
      ...priceSchemeHistory,
      ...efficiencyTargetHistory, // Gabungkan riwayat target
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // 4. Kembalikan data pengguna beserta riwayat yang sudah terstruktur.
    const {
      reading_sessions,
      price_schemes_set,
      efficiency_targets_set,
      ...user
    } = userWithRelations;
    return { ...user, history: fullHistory };
  }

  public override async create(data: CreateUserBody): Promise<User> {
    const { password, roleName, ...restOfData } = data;

    const role = await prisma.role.findUnique({
      where: { role_name: roleName },
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
        where: { role_name: roleName },
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
