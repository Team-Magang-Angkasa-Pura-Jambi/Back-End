import { z } from 'zod';

const numericString = z.string().regex(/^\d+$/, 'Harus berupa angka').trim();

export const getUserSchema = z.object({
  params: z.object({
    userId: z.coerce
      // Tambahan 1: Pesan error khusus jika input bukan format angka
      .number({
        error: 'ID parameter harus berupa format angka.',
      })
      .positive('ID parameter harus merupakan angka positif.')
      // Tambahan 2: Memastikan ID adalah bilangan bulat (integer)
      .int('ID parameter harus berupa bilangan bulat.'),
  }),
});

export const getUsersSchema = z.object({
  query: z.object({
    search: z.string().optional(),

    role_id: numericString.transform(Number).optional(),

    page: numericString.default('1').transform(Number),

    limit: numericString.default('10').transform(Number),
  }),
});
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
    role_id: z.coerce
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

export const deleteUserSchema = z.object({
  params: z.object({
    userId: z.coerce
      // Tambahan 1: Pesan error khusus jika input bukan format angka
      .number({
        error: 'ID parameter harus berupa format angka.',
      })
      .positive('ID parameter harus merupakan angka positif.')
      // Tambahan 2: Memastikan ID adalah bilangan bulat (integer)
      .int('ID parameter harus berupa bilangan bulat.'),
  }),
});
export type GetUsersQuery = z.infer<typeof getUsersSchema>['query'];
