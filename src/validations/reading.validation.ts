import z from 'zod';
import { isoDate, positiveInt, positiveNumber } from './schmeHelper.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';

export const readingSessionBodySchema = z.object({
  reading_date: isoDate('Tanggal Pembacaan').optional(),
  meter_id: positiveInt('ID Meteran'),
  is_correction_for_id: positiveInt('ID Sesi Asli').nullable().optional(),
  details: z
    .array(
      z.object({
        value: positiveNumber('Nilai Pembacaan'),
        reading_type_id: positiveInt('ID Tipe Pembacaan'),
      })
    )
    .min(1, 'Minimal harus ada satu detail pembacaan.'),
});

export const readingSessionParamsSchema = z.object({
  sessionId: positiveInt('ID Sesi'),
});
export const readingSessionSchemas = new CrudSchemaBuilder({
  bodySchema: readingSessionBodySchema,
  paramsSchema: readingSessionParamsSchema,
});

export const getReadingsSchema = z.object({
  energyTypeName: z.enum(['Electricity', 'Water', 'Fuel']).optional(),
  date: z.coerce.date().optional(),
  meterId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
export const queryLastReading = z.object({
  query: z.object({
    meterId: positiveInt('meter ID'),
    readingTypeId: positiveInt('reading Type Id'),
  }),
});
