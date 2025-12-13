import { z } from 'zod';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';
import {
  optionalString,
  positiveInt,
  requiredString,
  zodString,
} from './schmeHelper.js';
import { RoleName } from '../generated/prisma/index.js';

const userIdSchema = positiveInt('User ID');
const passwordRules = zodString('Password');
const usernameRules = zodString('Username');

const baseUserSchema = z.object({
  username: usernameRules,
  password: passwordRules,
  role_id: positiveInt('Role ID').default(1),
  photo_profile_url: zodString('photo profile url').optional(),
  is_active: z.boolean().default(true),
});

const userParamsSchema = z.object({
  userId: userIdSchema,
});

export const userQuerySchema = z.object({
  query: z.object({
    roleName: z.nativeEnum(RoleName).optional(),
    isActive: z.coerce.boolean().optional(),
    search: z.string().trim().optional(),
  }),
});

export const userSchemas = new CrudSchemaBuilder({
  bodySchema: baseUserSchema,
  paramsSchema: userParamsSchema,
})
  .addCustomSchema(
    'login',
    z.object({
      body: baseUserSchema.pick({ username: true }).extend({
        password: passwordRules,
      }),
    })
  )
  .addCustomSchema(
    'changePassword',
    z.object({
      params: userParamsSchema,
      body: z.object({
        oldPassword: passwordRules.describe('Password Lama'),
        newPassword: passwordRules.describe('Password Baru'),
      }),
    })
  );
