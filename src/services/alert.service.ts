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

  public async findAllWithQuery(query: GetAlertsQuery): Promise<{
    data: Alert[];
    meta: { total: number; page: number; limit: number; last_page: number };
  }> {
    const { page, limit, startDate, endDate, status, meterId, search } = query;

    const where: Prisma.AlertWhereInput = {};

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
}

export const alertService = new AlertService();
