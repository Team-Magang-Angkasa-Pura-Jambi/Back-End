import { Prisma, AlertStatus } from '../generated/prisma/index.js';
import prisma from '../configs/db.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';
import type {
  Alert,
  PrismaAlert,
  GetAlertsQuery,
  UpdateAlertBody,
} from '../types/alert.types.js';

export class AlertService extends GenericBaseService<
  typeof prisma.alert,
  PrismaAlert,
  Prisma.AlertCreateInput,
  UpdateAlertBody,
  Prisma.AlertFindManyArgs,
  Prisma.AlertFindUniqueArgs,
  Prisma.AlertCreateArgs,
  Prisma.AlertUpdateArgs,
  Prisma.AlertDeleteArgs
> {
  constructor() {
    super(prisma, prisma.alert, 'alert_id');
  }

  public async findAllWithQuery(
    query: GetAlertsQuery,
    scope: 'all' | 'system' | 'meters' = 'all'
  ): Promise<{
    data: Alert[];
    meta: { total: number; page: number; limit: number; last_page: number };
  }> {
    const { page, limit, startDate, endDate, status, meterId, search } = query;

    const where: Prisma.AlertWhereInput = {};

    // BARU: Tambahkan filter berdasarkan scope
    if (scope === 'system') {
      where.meter_id = null;
    } else if (scope === 'meters') {
      where.meter_id = {
        not: null,
      };
    }

    if (startDate && endDate) {
      where.alert_timestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }
    if (status) {
      where.status = status;
    }
    if (meterId) {
      where.meter_id = meterId;
    }

    if (search) {
      where.OR = [
        // { title: { contains: search, mode: 'insensitive' } },
        // { description: { contains: search, mode: 'insensitive' } },
        {
          meter: { meter_code: { contains: search, mode: 'insensitive' } },
        },
      ];
    }

    const findArgs: Prisma.AlertFindManyArgs = {
      where,
      include: {
        meter: {
          select: {
            meter_code: true,
            energy_type: { select: { type_name: true } },
          },
        },
        acknowledged_by: { select: { username: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        alert_timestamp: 'desc',
      },
    };

    // The `count` operation in Prisma does not support filtering on relations
    // in the same way `findMany` does, especially with `OR` conditions on relations.
    // We create a separate `where` for count that excludes the relational search filter.
    const countWhere: Prisma.AlertWhereInput = { ...where };
    if (search) {
      // Exclude the relational search from the count for simplicity.
      // A more complex solution might be needed for exact search counts with pagination.
      delete countWhere.OR;
    }

    const [total, data] = await this._prisma.$transaction([
      this._model.count({ where: countWhere }),
      this._model.findMany(findArgs),
    ]);

    return {
      data,
      meta: { total, page, limit, last_page: Math.ceil(total / limit) },
    };
  }

  public async getUnreadCount(meterId?: number): Promise<number> {
    return this._handleCrudOperation(() =>
      this._model.count({
        where: {
          status: AlertStatus.NEW,
          ...(meterId && { meter_id: meterId }),
        },
      })
    );
  }

  public async acknowledge(alertId: number, userId: number): Promise<Alert> {
    return this._handleCrudOperation(async () => {
      const updatedAlert = await this._model.update({
        where: { [this._idField]: alertId },
        data: {
          status: AlertStatus.READ,
          acknowledged_by_user_id: userId,
        },
        include: {
          meter: {
            select: {
              meter_code: true,
              energy_type: { select: { type_name: true } },
            },
          },
          acknowledged_by: { select: { username: true } },
        },
      });
      return updatedAlert as Alert;
    });
  }

  public async acknowledgeAll(userId: number): Promise<Prisma.BatchPayload> {
    return this._handleCrudOperation(() =>
      this._model.updateMany({
        where: { status: AlertStatus.NEW },
        data: {
          status: AlertStatus.READ,
          acknowledged_by_user_id: userId,
        },
      })
    );
  }

  /**
   * BARU: Memperbarui status sebuah alert.
   * @param alertId - ID dari alert yang akan diubah.
   * @param status - Status baru ('READ' atau 'HANDLED').
   * @param userId - ID pengguna yang melakukan aksi (opsional, untuk acknowledge).
   * @returns Alert yang telah diperbarui.
   */
  public async updateStatus(
    alertId: number,
    status: AlertStatus,
    userId: number
  ): Promise<Alert> {
    return this._handleCrudOperation(async () => {
      const data: Prisma.AlertUpdateInput = { status };

      // Jika status diubah menjadi READ dan belum ada yg acknowledge, catat user ID
      // Ini mirip dengan fungsi acknowledge, tapi lebih generik.
      if (status === AlertStatus.READ) {
        const currentAlert = await this._model.findUnique({
          where: { alert_id: alertId },
        });
        if (currentAlert && !currentAlert.acknowledged_by_user_id) {
          data.acknowledged_by_user_id = userId;
        }
      }

      const updatedAlert = await this._model.update({
        where: { [this._idField]: alertId },
        data,
      });
      return updatedAlert as Alert;
    });
  }

  /**
   * BARU: Mengambil beberapa alert terbaru.
   * @param scope - Filter untuk 'system' atau 'meters'.
   * @param limit - Jumlah alert yang akan diambil.
   * @returns Daftar alert terbaru.
   */
  public async getLatest(
    scope?: 'system' | 'meters',
    limit = 5,
    status?: AlertStatus // BARU: Tambahkan parameter status
  ): Promise<Alert[]> {
    return this._handleCrudOperation(async () => {
      const where: Prisma.AlertWhereInput = {};

      // Filter berdasarkan scope (system/meters)
      if (scope === 'system') {
        where.meter_id = null;
      } else if (scope === 'meters') {
        where.meter_id = { not: null };
      }

      // PERBAIKAN: Logika filter status yang lebih baik.
      if (status) {
        // Jika status spesifik diminta (misal: 'NEW'), gunakan itu.
        where.status = status;
      } else {
        // Jika tidak ada status yang diminta, secara default tampilkan semua yang BELUM ditangani.
        where.status = { not: AlertStatus.HANDLED };
      }

      const alerts = await this._model.findMany({
        where,
        take: limit,
        orderBy: {
          alert_timestamp: 'desc',
        },
        include: {
          meter: {
            select: {
              meter_code: true,
            },
          },
          acknowledged_by: { select: { username: true } },
        },
      });
      return alerts as Alert[];
    });
  }

  /**
   * BARU: Menghapus beberapa alert berdasarkan ID.
   * @param alertIds - Array dari ID alert yang akan dihapus.
   * @returns Hasil operasi deleteMany dari Prisma.
   */
  public async deleteManyByIds(
    alertIds: number[]
  ): Promise<Prisma.BatchPayload> {
    return this._handleCrudOperation(() =>
      this._model.deleteMany({
        where: {
          alert_id: {
            in: alertIds,
          },
        },
      })
    );
  }
}

export const alertService = new AlertService();
