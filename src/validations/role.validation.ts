import { z } from 'zod';
import { RoleName } from '../generated/prisma/index.js';
import { positiveInt, requiredString } from './schmeHelper.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';

export const roleBodySchema = z.object({
  role_name: z.enum(RoleName),
});

export const roleParamsSchema = z.object({
  roleId: positiveInt('Role ID'),
});
export const roleSchemas = new CrudSchemaBuilder({
  bodySchema: roleBodySchema,
  paramsSchema: roleParamsSchema,
});
