import bcrypt from 'bcrypt';
import prisma from '../configs/db.js';
import { Prisma, RoleName } from '../generated/prisma/index.js';
import type {
  CreateUserBody,
  UpdateUserBody,
  User,
} from '../types/user.type.js';
import { Error404, Error409 } from '../utils/customError.js';
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
        const { password, ...restData } = data; // Pisahkan password
        const restoredUser = await this._model.update({
          where: { user_id: existingUser.user_id },
          data: {
            // ...restData,npm
            is_active: true, // Aktifkan kembali
            role: { connect: { role_id: data.role_id } },
            password_hash: hashedPassword,
          },
          include: { role: true },
        });
        return restoredUser as User;
      }

      // Jika pengguna sama sekali tidak ada, buat baru.
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const { password, ...restData } = data; // Pisahkan password
      const newUser = await this._model.create({
        data: {
          ...restData,
          password_hash: hashedPassword,
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

  /**
   * BARU: Mengambil semua pengguna dengan filter `is_active: true` secara default.
   * Ini akan menimpa metode `findAll` dari GenericBaseService.
   * @param args - Argumen query dari Prisma, seperti `where`, `orderBy`, dll.
   * @returns Daftar pengguna yang aktif.
   */
  public override async findAll(
    args?: Prisma.UserFindManyArgs
  ): Promise<User[]> {
    // Gabungkan argumen yang ada dengan filter is_active: true
    const findArgs: Prisma.UserFindManyArgs = {
      ...args,
      where: {
        ...args?.where,
        is_active: true,
      },
      include: { role: true },
    };
    return super.findAll(findArgs);
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

  public override async update(
    id: number,
    data: UpdateUserBody
  ): Promise<User> {
    return this._handleCrudOperation(async () => {
      // Pisahkan data yang memerlukan penanganan khusus
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

  /**
   * BARU: Menghapus pengguna secara permanen (hard delete).
   * Operasi ini akan menghapus semua data terkait pengguna di dalam satu transaksi.
   * Gunakan dengan hati-hati karena data tidak dapat dipulihkan.
   * @param id - ID pengguna yang akan dihapus paksa.
   */
  public async forceDelete(id: number): Promise<User> {
    return this._handleCrudOperation(async () => {
      const user = await this._model.findUnique({ where: { user_id: id } });
      if (!user) {
        throw new Error404(`Pengguna dengan ID ${id} tidak ditemukan.`);
      }

      const [deletedUser] = await this._prisma.$transaction([
        this._prisma.notification.deleteMany({ where: { user_id: id } }),
        this._prisma.readingSession.deleteMany({ where: { user_id: id } }),

        this._prisma.alert.updateMany({
          where: { acknowledged_by_user_id: id },
          data: { acknowledged_by_user_id: null },
        }),
        this._prisma.analyticsInsight.updateMany({
          where: { acknowledged_by_user_id: id },
          data: { acknowledged_by_user_id: null },
        }),
        this._prisma.dailyLogbook.updateMany({
          where: { edited_by_user_id: id },
          data: { edited_by_user_id: null },
        }),

        this._prisma.priceScheme.deleteMany({ where: { set_by_user_id: id } }),
        this._prisma.efficiencyTarget.deleteMany({
          where: { set_by_user_id: id },
        }),

        this._model.delete({ where: { user_id: id } }),
      ]);

      return user as User;
    });
  }
}

export const userService = new UserService();
