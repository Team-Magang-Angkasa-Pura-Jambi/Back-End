import z from 'zod';
import { RoleType } from '../../generated/prisma/index.js';

export const usersSchema = {
  show: z.object({
    query: z.object({
      username: z.string().optional(),
      full_name: z.string().optional(),
      role_name: z.nativeEnum(RoleType).optional(),
    }),
    params: z.object({
      id: z.coerce.number().optional(),
    }),
  }),

  store: z.object({
    body: z.object({
      username: z.string().min(3, 'Username minimal 3 karakter'),
      full_name: z.string(),
      email: z.string().email('Format email tidak valid'),
      password: z.string().min(6, 'Password minimal 6 karakter'),
      image_url: z.string().url().nullable().default(null),
      role_id: z.coerce.number().int('Role ID harus berupa angka bulat'),
      is_active: z.coerce.boolean().default(true),
    }),
  }),

  patch: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID User harus diisi' }),
    }),
    body: z.object({
      username: z.string().min(3).optional(),
      full_name: z.string().optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      image_url: z.string().url().optional().nullable().or(z.literal('')),
      role_id: z.coerce.number().int().optional(),
      is_active: z.coerce.boolean().optional(),
    }),
  }),
};

export type UserBodyPayload = z.infer<typeof usersSchema.store>['body'];
export type UpdateUserPayload = z.infer<typeof usersSchema.patch>['body'];
