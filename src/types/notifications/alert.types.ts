// Note: Alert, AlertStatus, InsightSeverity, InsightStatus are not in the current Prisma schema.
// Using local string literal types until the schema is updated.

export type InsightSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InsightStatus = 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';
export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';

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

export interface Alert {
  meter?: {
    meter_code: string;
    energy_type?: { type_name: string };
  } | null;
  acknowledged_by?: { username: string } | null;
  [key: string]: unknown;
}
