import { z } from 'zod';
import { isoDate, positiveInt } from '../../utils/schmeHelper.js';
import { AlertStatus, InsightSeverity } from '../../generated/prisma/index.js';

export const getAlertsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    startDate: isoDate('Tanggal Mulai').optional(),
    endDate: isoDate('Tanggal Selesai').optional(),
    severity: z.nativeEnum(InsightSeverity).optional(), // Note: Alert model doesn't have severity, this might be for AnalyticsInsight
    status: z.nativeEnum(AlertStatus).optional(),
    meterId: positiveInt('ID Meter').optional(),
    search: z.string().trim().optional(),
  }),
});

export const alertIdParamSchema = z.object({
  params: z.object({
    alertId: positiveInt('ID Alert'),
  }),
});

export const emptySchema = z.object({});

export const getLatestAlertsSchema = z.object({
  query: z.object({
    scope: z.enum(['system', 'meters']).optional(),
    // BARU: Tambahkan filter status, misalnya untuk mengambil hanya yang 'NEW'
    status: z.nativeEnum(AlertStatus).optional(),
  }),
});

export const updateAlertStatusSchema = z.object({
  params: z.object({
    alertId: positiveInt('ID Alert'),
  }),
});

export const bulkDeleteAlertsSchema = z.object({
  body: z.object({
    alertIds: z
      .array(positiveInt('Alert ID'))
      .min(1, 'Setidaknya satu ID alert diperlukan.'),
  }),
});

export const bulkUpdateAlertsSchema = z.object({
  body: z.object({
    alertIds: z
      .array(positiveInt('Alert ID'))
      .min(1, 'Setidaknya satu ID alert diperlukan.'),
  }),
});
