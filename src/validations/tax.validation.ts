import z from 'zod';
import {
  positiveInt,
  positiveNumber,
  requiredString,
} from '../utils/schmeHelper.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';

const taxdefaultschema = z.object({
  tax_name: requiredString('tax name'),
  rate: positiveNumber('rate'),
  is_active: z.coerce.boolean().default(true),
});

const taxdefaultParamas = z.object({
  taxId: positiveInt('tax id'),
});

export const taxSchema = new CrudSchemaBuilder({
  bodySchema: taxdefaultschema,
  paramsSchema: taxdefaultParamas,
});
