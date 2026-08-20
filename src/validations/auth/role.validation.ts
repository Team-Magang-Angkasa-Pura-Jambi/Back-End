import { z } from 'zod';
import { RoleType } from '../../generated/prisma/index.js';
import { positiveInt } from '../../utils/schmeHelper.js';
import { CrudSchemaBuilder } from '../../utils/shemaHandler.js';

export const roleBodySchema = z.object({
  role_name: z.nativeEnum(RoleType),
});

export const roleParamsSchema = z.object({
  roleId: positiveInt('Role ID'),
});
export const roleSchemas = new CrudSchemaBuilder({
  bodySchema: roleBodySchema,
  paramsSchema: roleParamsSchema,
});
