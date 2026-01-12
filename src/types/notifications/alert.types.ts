import type {
  Prisma,
  InsightSeverity,
  InsightStatus,
  AlertStatus,
} from '../../generated/prisma/index.js';
import type { Alert as PrismaAlert } from '../../generated/prisma/index.js';

export interface GetAlertsQuery {
  page: number;
  limit: number;
  startDate?: string;
  endDate?: string;
  severity?: InsightSeverity;
  status?: AlertStatus;
  meterId?: number;
  search?: string;
}

export interface UpdateAlertBody {
  status?: InsightStatus;
  acknowledged_by_user_id?: number;
}

export type Alert = Prisma.AlertGetPayload<{
  include: {
    meter: {
      select: {
        meter_code: true;
        energy_type: { select: { type_name: true } };
      };
    };
    acknowledged_by: { select: { username: true } };
  };
}>;

export type { PrismaAlert };
