import bcrypt from 'bcrypt';
import prisma from '../configs/db.js';
import { Prisma, RoleName } from '../generated/prisma/index.js';
import type {
  CreateUserBody,
  UpdateUserBody,
  User,
} from '../types/user.types.js';
import { Error409 } from '../utils/customError.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';
import { notificationService } from './notification.service.js';

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
      const existingUser = await this._model.findUnique({
        where: { username: data.username },
      });

      if (existingUser) {
        throw new Error409('Username sudah digunakan.');
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);

      const newUser = await this._model.create({
        data: {
          username: data.username,
          password_hash: hashedPassword,
          role_id: data.role_id,
          is_active: data.is_active,
        },
        include: {
          role: true,
        },
      });

      // BARU: Kirim notifikasi ke semua admin dan superadmin
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
          link: `/management/users/${newUser.user_id}`, // Contoh link ke halaman detail user
        });
      }

      return newUser as User;
    });
  }

  /**
   * BARU: Mengambil riwayat aktivitas pengguna, seperti sesi pembacaan yang telah dibuat.
   * @param userId - ID pengguna yang riwayatnya akan diambil.
   * @returns Daftar sesi pembacaan yang diurutkan berdasarkan tanggal terbaru.
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
