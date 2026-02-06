import bcrypt from 'bcrypt';
import prisma from '../../configs/db.js';
import { type Prisma, RoleName, type User } from '../../generated/prisma/index.js';
import type { CreateUserBody, GetUsersQuery, UpdateUserBody } from '../../types/auth/user.type.js';
import { Error409 } from '../../utils/customError.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';
import { notificationService } from '../notifications/notification.service.js';

export interface userHistory {
  id: number;
  type: string;
  timestamp: string;
  description: string;
}

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
          `[UserService] Pengguna tidak aktif '${data.username}' ditemukan. Mengaktifkan kembali dengan data baru.`,
        );
        const hashedPassword = await bcrypt.hash(data.password, 10);

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

      const admins = await prisma.user.findMany({
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

  public override async findAll(args?: Partial<GetUsersQuery>): Promise<User[]> {
    const { roleName, isActive, search } = args ?? {};
    const where: Prisma.UserWhereInput = {};

    if (roleName) {
      where.role = { role_name: roleName };
    }
    if (isActive !== undefined) {
      where.is_active = isActive;
    }

    if (search) {
      where.username = { contains: search, mode: 'insensitive' };
    }

    return this._handleCrudOperation(() =>
      this._model.findMany({ where, include: { role: true } }),
    );
  }

  public override async update(id: number, data: UpdateUserBody): Promise<User> {
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

  public override async delete(id: number): Promise<User> {
    return this._handleCrudOperation(() =>
      this._model.update({
        where: { user_id: id },
        data: { is_active: false },
      }),
    );
  }

  public async findByUsername(username: string): Promise<(User & { role: any }) | null> {
    return this._handleCrudOperation(() =>
      this._model.findUnique({
        where: { username },
        include: { role: true },
      }),
    );
  }

  public async getActivityHistory(userId: number): Promise<userHistory[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const userWithRelations = await this._model.findUniqueOrThrow({
      where: { user_id: userId },
      include: {
        reading_sessions: {
          where: {
            created_at: { gte: sevenDaysAgo },
          },
          select: {
            session_id: true,
            created_at: true,
            meter: {
              select: {
                meter_code: true,
                energy_type: {
                  select: { type_name: true },
                },
              },
            },
          },
          orderBy: { created_at: 'desc' },
        },
        price_schemes_set: {
          where: {
            effective_date: { gte: sevenDaysAgo },
          },
          select: {
            scheme_id: true,
            effective_date: true,
            scheme_name: true,
            tariff_group: {
              select: { group_name: true },
            },
          },
          orderBy: { effective_date: 'desc' },
        },
        efficiency_targets_set: {
          where: {
            period_start: { gte: sevenDaysAgo },
          },
          select: {
            target_id: true,
            period_start: true,
            kpi_name: true,
            meter: {
              select: { meter_code: true },
            },
          },
          orderBy: { period_start: 'desc' },
        },
      },
    });

    const readingHistory: userHistory[] = userWithRelations.reading_sessions.map((session) => ({
      id: session.session_id,
      type: 'Pencatatan Meter',
      timestamp: session.created_at.toISOString(),
      description: `Melakukan pencatatan untuk meter ${session.meter.meter_code} (${session.meter.energy_type.type_name}).`,
    }));

    const priceSchemeHistory: userHistory[] = userWithRelations.price_schemes_set.map((scheme) => ({
      id: scheme.scheme_id,
      type: 'Pengaturan Harga',
      timestamp: scheme.effective_date.toISOString(),
      description: `Mengatur skema harga baru "${scheme.scheme_name}" untuk golongan tarif ${scheme.tariff_group.group_name}.`,
    }));

    const efficiencyTargetHistory: userHistory[] = userWithRelations.efficiency_targets_set.map(
      (target) => ({
        id: target.target_id,
        type: 'Pengaturan Target',
        timestamp: target.period_start.toISOString(),
        description: `Mengatur target "${target.kpi_name}" untuk meter ${target.meter.meter_code}.`,
      }),
    );

    const fullHistory: userHistory[] = [
      ...readingHistory,
      ...priceSchemeHistory,
      ...efficiencyTargetHistory,
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return fullHistory;
  }
}

export const userService = new UserService();
