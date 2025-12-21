import bcrypt from 'bcrypt';
import prisma from '../../configs/db.js';
import { Prisma, RoleName, User } from '../../generated/prisma/index.js';
import type {
  CreateUserBody,
  GetUsersQuery,
  UpdateUserBody,
} from '../../types/auth/user.type.js';
import { Error409 } from '../../utils/customError.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';
import { notificationService } from '../notification.service.js';

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

  public override async create(data: CreateUserBody): Promise<User> {
    return this._handleCrudOperation(async () => {
      const existingUser = await this._model.findFirst({
        where: { username: data.username },
      });

      if (existingUser) {
        if (existingUser.is_active) {
          throw new Error409('Username sudah digunakan oleh pengguna aktif.');
        }

        console.log(
          `[UserService] Pengguna tidak aktif '${data.username}' ditemukan. Mengaktifkan kembali dengan data baru.`
        );
        const hashedPassword = await bcrypt.hash(data.password, 10);
        // const { password } = data;
        const restoredUser = await this._model.update({
          where: { user_id: existingUser.user_id },
          data: {
            is_active: true,
            role: { connect: { role_id: data.role_id } },
            password_hash: hashedPassword,
          },
          include: { role: true },
        });
        return restoredUser as User;
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const { password, ...restData } = data;
      const newUser = await this._model.create({
        data: {
          ...restData,
          password_hash: hashedPassword,
        },
        include: {
          role: true,
        },
      });

      const admins = await this._prisma.user.findMany({
        where: {
          role: { role_name: { in: [RoleName.Admin, RoleName.SuperAdmin] } },
          is_active: true,
        },
        select: { user_id: true },
      });

      const message = `Pengguna baru dengan nama "${
        newUser.username
      }" dan peran "${newUser.role.role_name}" telah ditambahkan ke sistem.`;

      for (const admin of admins) {
        await notificationService.create({
          user_id: admin.user_id,
          title: 'Pengguna Baru Dibuat',
          message,
          link: `/management/users/${newUser.user_id}`,
        });
      }

      return newUser as User;
    });
  }

  /**
   * BARU: Mengambil semua pengguna dengan filter `is_active: true` secara default.
   * Ini akan menimpa metode `findAll` dari GenericBaseService.
   * @param args - Argumen query dari Prisma, seperti `where`, `orderBy`, dll.
   * @returns Daftar pengguna yang aktif.
   */

  public override async findAll(query?: any): Promise<User[]> {
    const typedQuery: GetUsersQuery = query || {};
    const { roleName, isActive, search } = typedQuery;

    const findArgs: Prisma.UserFindManyArgs = {
      where: {
        ...(roleName && { role: { role_name: roleName } }),
        is_active: isActive ?? true,
        ...(search && {
          username: { contains: search, mode: 'insensitive' },
        }),
      },
      include: { role: true },
    };

    return this._handleCrudOperation(() => this._model.findMany(findArgs));
  }

  public override async update(
    id: number,
    data: UpdateUserBody
  ): Promise<User> {
    return this._handleCrudOperation(async () => {
      const { role_id, password, ...restData } = data;
      const updateData: Prisma.UserUpdateInput = { ...restData };

      if (password) {
        updateData.password_hash = await bcrypt.hash(password, 10);
      }

      if (role_id) {
        updateData.role = {
          connect: { role_id: role_id },
        };
      }

      const updatedUser = await this._model.update({
        where: { user_id: id },
        data: updateData,
        include: { role: true },
      });

      return updatedUser as User;
    });
  }

  /**
   * Melakukan soft delete dengan mengubah status is_active menjadi false.
   * Ini memastikan integritas data historis tetap terjaga.
   * @param id - ID pengguna yang akan di-nonaktifkan.
   */
  public override async delete(id: number): Promise<User> {
    return this._handleCrudOperation(() =>
      this._model.update({
        where: { user_id: id },
        data: { is_active: false },
      })
    );
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
  /**
   * BARU: Mengambil riwayat aktivitas pengguna, seperti sesi pembacaan yang telah dibuat.
   * @param userId - ID pengguna yang riwayatnya akan diambil.
   * @returns Daftar sesi pembacaan yang diurutkan berdasarkan tanggal terbaru.
   */

  public async getActivityHistory(userId: number) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const userWithRelations = await this._model.findUniqueOrThrow({
      where: { user_id: userId },

      include: {
        reading_sessions: {
          where: {
            created_at: { gte: sevenDaysAgo },
          },
          include: {
            meter: { select: { meter_code: true, energy_type: true } },
          },
          orderBy: { created_at: 'desc' },
        },

        price_schemes_set: {
          where: {
            effective_date: { gte: sevenDaysAgo },
          },
          include: { tariff_group: { select: { group_name: true } } },
          orderBy: { effective_date: 'desc' },
        },

        efficiency_targets_set: {
          where: {
            period_start: { gte: sevenDaysAgo },
          },
          include: { meter: { select: { meter_code: true } } },
          orderBy: { period_start: 'desc' },
        },
      },
    });

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

    const efficiencyTargetHistory =
      userWithRelations.efficiency_targets_set.map((target) => ({
        type: 'Pengaturan Target',
        timestamp: target.period_start,
        description: `Mengatur target "${target.kpi_name}" untuk meter ${target.meter.meter_code}.`,
        details: target,
      }));

    const fullHistory = [
      ...readingHistory,
      ...priceSchemeHistory,
      ...efficiencyTargetHistory,
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const {
      reading_sessions,
      price_schemes_set,
      efficiency_targets_set,
      ...user
    } = userWithRelations;
    return { ...user, history: fullHistory };
  }
}

export const userService = new UserService();
