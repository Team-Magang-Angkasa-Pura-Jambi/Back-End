import { z } from 'zod';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';
import { positiveInt, requiredString } from './schmeHelper.js';

// Skema body untuk User
const userBodySchema = z.object({
  username: requiredString('Username').min(3),
  password: requiredString('Password').min(6),
  role_id: positiveInt('Role ID').default(2),
  is_active: z.boolean().default(true),
});

// Skema params (misal pakai id number)
const userParamsSchema = z.object({
  userId: positiveInt('User ID'),
});

// Buat schema CRUD pakai builder
export const userSchemas = new CrudSchemaBuilder({
  bodySchema: userBodySchema,
  paramsSchema: userParamsSchema,
})
  .addCustomSchema(
    'login',
    z.object({
      body: z.object({
        username: requiredString('Username'),
        password: requiredString('Password'),
      }),
    })
  )
  .addCustomSchema(
    'changePassword',
    z.object({
      body: z.object({
        oldPassword: requiredString('Password lama'),
        newPassword: requiredString('Password baru').min(6),
      }),
      params: userParamsSchema,
    })
  );

export const userQuerySchema = z.object({
  role_id: z.coerce.number().int().positive().optional(),
  is_active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
});
