import { z } from 'zod';

export const menusSchema = {
  create: z.object({
    body: z.object({
      name: z.string({ error: 'Nama menu harus diisi' }),
      route: z.string().nullable().optional(),
      icon_name: z.string().nullable().optional(),
      allowed_roles: z.array(z.string()).optional(),
      status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).optional().default('ACTIVE'),
      parent_id: z.number().nullable().optional(),
      sort_order: z.number().optional().default(0),
    }),
  }),

  patch: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID Menu harus berupa angka' }),
    }),
    body: z.object({
      name: z.string().optional(),
      route: z.string().nullable().optional(),
      icon_name: z.string().nullable().optional(),
      allowed_roles: z.array(z.string()).optional(),
      status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).optional(),
      parent_id: z.number().nullable().optional(),
      sort_order: z.number().optional(),
    }),
  }),
};
