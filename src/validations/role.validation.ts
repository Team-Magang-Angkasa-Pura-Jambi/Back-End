import { z } from 'zod';
import { RoleName } from '../generated/prisma/index.js';

export const createRoleSchema = z.object({
  body: z.object({
    role_name: z.nativeEnum(RoleName, {
      error: 'Nama peran tidak valid.',
    }),
  }),
});

export const updateRoleSchema = z.object({
  params: z.object({
    id: z.coerce.number().positive('ID peran harus angka positif.').int(),
  }),

  body: z
    .object({
      role_name: z.nativeEnum(RoleName, {
        error:
          'Jika diisi, nama peran harus merupakan salah satu dari: Technician, Admin, SuperAdmin.',
      }),
    })
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Body request untuk update tidak boleh kosong.',
    })
    .strict(),
});
