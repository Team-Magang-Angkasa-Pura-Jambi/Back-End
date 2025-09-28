import z from 'zod';
import { positiveInt, positiveNumber, requiredString } from './schmeHelper.js';
import { RateType } from '../generated/prisma/index.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';

const defaultSchema = z.object({
  rate_name: requiredString('rate name'),
  value: positiveNumber('value'),
  rate_type: z.enum(RateType),
  scheme_id: positiveInt('schema Id'),
});
const defaultParamsSchema = z.object({
  rateId: positiveInt('User ID'),
});
export const schemaRateSchemas = new CrudSchemaBuilder({
  bodySchema: defaultSchema,
  paramsSchema: defaultParamsSchema,
});
