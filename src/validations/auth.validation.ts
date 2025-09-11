import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    username: z.string({ error: 'Username is required' }).min(3),
    password: z.string({ error: 'Password is required' }).min(6),
    role_id: z.coerce
      .number({ error: 'Role ID must be a number.' })
      .int()
      .positive()
      .default(2),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    username: z.string().min(3, 'Username minimal 3 karakter.').optional(),
    password: z.string().min(6, 'Password minimal 6 karakter.').optional(),
    role_id: z
      .number()
      .int()
      .positive('Role ID harus angka positif.')
      .optional(),
  }),
  params: z.object({
    userId: z.string().refine((val) => !isNaN(parseInt(val, 10)), {
      message: 'User ID harus berupa angka.',
    }),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    username: z.string({ error: 'Username is required' }),
    password: z.string({ error: 'Password is required' }),
  }),
});

