import { z } from 'zod';
import { positiveInt, requiredString } from './schmeHelper.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';

const Schema = z.object({
  scheme_name: requiredString('schema name'),

  effective_date: z.coerce.date({
    error: 'Tanggal efektif wajib diisi.',
  }),

  is_active: z.boolean().optional().default(true),

  energy_type_id: positiveInt('energy type id'),
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
    energyTypeId: positiveInt('energy type id').optional(),
  })
);
