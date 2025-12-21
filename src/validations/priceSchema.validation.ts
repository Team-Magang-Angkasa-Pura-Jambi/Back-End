import { z } from 'zod';
import {
  positiveInt,
  positiveNumber,
  requiredString,
} from '../utils/schmeHelper.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';

const Schema = z.object({
  scheme_name: requiredString('schema name'),

  effective_date: z.coerce.date({
    error: 'Tanggal efektif wajib diisi.',
  }),

  is_active: z.boolean().optional().default(true),

  tariff_group_id: positiveInt('tariff group id'),

  rates: z
    .array(
      z.object({
        reading_type_id: positiveInt('Reading Type ID'),
        value: z.number(),
      })
    )
    .min(1, 'At least one rate must be provided.')
    .refine(
      (items) =>
        new Set(items.map((i) => i.reading_type_id)).size === items.length,
      {
        message: 'Each reading type can only have one rate per scheme.',
      }
    ),

  tax_ids: z.array(positiveInt('Tax ID')).optional(),
});

const paramsSchema = z.object({
  schemeId: positiveInt('Schema Id'),
});

export const priceSchema = new CrudSchemaBuilder({
  bodySchema: Schema,
  paramsSchema: paramsSchema,
});

export const queryPriceSchema = priceSchema.getList(
  z.object({
    tariffGroupId: positiveInt('tariff group id').optional(),
  })
);
