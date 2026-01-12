import { Prisma, AlertStatus } from '../../generated/prisma/index.js';
import prisma from '../../configs/db.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';
import type {
  Alert,
  PrismaAlert,
  UpdateAlertBody,
} from '../../types/notifications/alert.types.js';

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
  public async getMetersAlerts() {
    try {
      const [alerts, total] = await prisma.$transaction([
        prisma.alert.findMany({
          where: {
            meter_id: { not: null },
          },
          include: {
            meter: {
              select: {
                meter_code: true,
                energy_type: {
                  select: { type_name: true },
                },
              },
            },
            acknowledged_by: {
              select: {
                username: true,
              },
            },
          },
          orderBy: {
            alert_timestamp: 'desc',
          },
        }),
        prisma.alert.count({
          where: { meter_id: { not: null } },
        }),
      ]);

      const formattedAlerts = alerts.map((alert) => ({
        alert_id: alert.alert_id,
        target_id: alert.target_id ?? null,
        title: alert.title,
        description: alert.description,
        status: alert.status,
        actual_value: alert.actual_value ? Number(alert.actual_value) : null,
        target_value_at_trigger: alert.target_value_at_trigger
          ? Number(alert.target_value_at_trigger)
          : null,

        meter_code: alert.meter?.meter_code ?? null,
        acknowledged_by: alert.acknowledged_by_user_id ?? null,
        username: alert.acknowledged_by?.username ?? null,

        alert_timestamp: alert.alert_timestamp,
      }));

      return {
        data: formattedAlerts,
        meta: {
          total: total,
        },
      };
    } catch (error) {
      console.error('Error fetching meter alerts:', error);
      throw new Error('Gagal mengambil data alert meteran.');
    }
  }

  public async getSystemAlerts() {
    try {
      const [alerts, total] = await prisma.$transaction([
        prisma.alert.findMany({
          where: {
            meter_id: null,
          },
          include: {
            acknowledged_by: {
              select: {
                username: true,
              },
            },
          },
          orderBy: {
            alert_timestamp: 'desc',
          },
        }),
        prisma.alert.count({
          where: { meter_id: null },
        }),
      ]);

      const formattedAlerts = alerts.map((alert) => ({
        alert_id: alert.alert_id,
        target_id: alert.target_id ?? null,
        title: alert.title,
        description: alert.description,
        status: alert.status,
        actual_value: alert.actual_value ? Number(alert.actual_value) : null,
        target_value_at_trigger: alert.target_value_at_trigger
          ? Number(alert.target_value_at_trigger)
          : null,

        meter_code: null,

        acknowledged_by: alert.acknowledged_by_user_id ?? null,
        username: alert.acknowledged_by?.username ?? null,

        alert_timestamp: alert.alert_timestamp,
      }));

      return {
        data: formattedAlerts,
        meta: {
          total: total,
        },
      };
    } catch (error) {
      console.error('Error fetching system alerts:', error);
      throw new Error('Gagal mengambil data alert sistem.');
    }
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
        where: { alert_id: alertId },
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
  public async updateStatus(alertId: number): Promise<Alert> {
    return this._handleCrudOperation(async () => {
      const updatedAlert = await this._model.update({
        where: { alert_id: alertId },
        data: {
          status: 'READ',
        },
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
    status?: AlertStatus
  ): Promise<Alert[]> {
    return this._handleCrudOperation(async () => {
      const where: Prisma.AlertWhereInput = {};

      if (scope === 'system') {
        where.meter_id = null;
      } else if (scope === 'meters') {
        where.meter_id = { not: null };
      }

      if (status) {
        where.status = status;
      } else {
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
      prisma.alert.deleteMany({
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
