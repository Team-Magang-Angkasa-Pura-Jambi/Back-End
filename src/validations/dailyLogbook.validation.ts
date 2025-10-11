import { z } from 'zod';
import { optionalString, positiveInt } from './schmeHelper.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';

// Skema untuk parameter query saat mengambil daftar logbook
export const getLogbooksQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

// Skema untuk parameter URL (misal: /logbooks/123)
const logbookParamsSchema = z.object({
  logId: positiveInt('Logbook ID'),
});

// Skema untuk body request (misalnya saat menambahkan catatan manual)
const dailyLogbookBodySchema = z.object({
  manual_notes: optionalString('Catatan Manual'),
});

// Skema untuk body request saat generate manual
export const generateLogbookBodySchema = z.object({
  body: z.object({
    date: z.string().datetime(),
  }),
});

// Gabungkan skema untuk digunakan di router
export const logbookSchemas = new CrudSchemaBuilder({
  paramsSchema: logbookParamsSchema,
  bodySchema: dailyLogbookBodySchema,
});
