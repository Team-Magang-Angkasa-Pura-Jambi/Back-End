import { z } from 'zod';
import { positiveInt, requiredString } from './schmeHelper.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';

export const ReadingTypeBodySchema = z.object({
  type_name: requiredString('type name'),
  energy_type_id: positiveInt('energy type name'),
});
const ReadingTypeParamsSchema = z.object({
  readingTypeId: positiveInt('User ID'),
});

export const readingTypeSchema = new CrudSchemaBuilder({
  bodySchema: ReadingTypeBodySchema,
  paramsSchema: ReadingTypeParamsSchema,
});

export const queryGetByMeter = z.object({
  query: z.object({
    meterId: positiveInt('meter ID').optional(),
    energyTypeId: positiveInt('energy type id').optional(),
  }),
});
