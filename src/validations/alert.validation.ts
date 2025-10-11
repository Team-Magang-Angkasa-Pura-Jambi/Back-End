import { z } from 'zod';
import { isoDate, positiveInt } from './schmeHelper.js';
import { InsightSeverity, InsightStatus } from '../generated/prisma/index.js';

export const getAlertsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    startDate: isoDate('Tanggal Mulai').optional(),
    endDate: isoDate('Tanggal Selesai').optional(),
    severity: z.nativeEnum(InsightSeverity).optional(),
    status: z.nativeEnum(InsightStatus).optional(),
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
