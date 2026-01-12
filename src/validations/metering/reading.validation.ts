import z from 'zod';
import { isoDate, positiveInt, positiveNumber } from '../../utils/schmeHelper.js';
import { CrudSchemaBuilder } from '../../utils/shemaHandler.js';
import { DateRangeRules, PaginationRules } from '../common/index.js';

const EnergyTypeEnum = z.enum(['Electricity', 'Water', 'Fuel']);

const QueryIdentifiers = z.object({
  meterId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  readingTypeId: z.coerce.number().int().positive().optional(),
});

export const readingSessionBodySchema = z.object({
  reading_date: isoDate('Tanggal Pembacaan'),
  meter_id: positiveInt('ID Meteran'),
  is_correction_for_id: positiveInt('ID Sesi Asli').nullable().optional(),
  details: z
    .array(
      z.object({
        value: positiveNumber('Nilai Pembacaan'),
        reading_type_id: positiveInt('ID Tipe Pembacaan'),
      }),
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
  query: PaginationRules.merge(QueryIdentifiers.pick({ meterId: true, userId: true })).extend({
    energyTypeName: EnergyTypeEnum.optional(),
    date: z.coerce.date().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
});

export const queryLastReading = z.object({
  query: z.object({
    meterId: positiveInt('meter ID'),
    readingTypeId: positiveInt('reading Type Id'),
    readingDate: isoDate('reading date'),
  }),
});

export const getHistoryQuerySchema = z.object({
  query: DateRangeRules.merge(QueryIdentifiers.pick({ meterId: true })).extend({
    energyTypeName: EnergyTypeEnum.optional(),
    sortBy: z.enum(['reading_date', 'created_at']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});
