import { z } from 'zod';

export const notificationsSchema = {
  store: z.object({
    body: z.object({
      user_id: z.number(),
      category: z.string(),
      severity: z.string(),
      title: z.string().min(3),
      message: z.string(),
      reference_table: z.string().optional(),
      reference_id: z.number().optional(),
    }),
  }),

  show: z.object({
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      is_read: z.enum(['true', 'false']).optional(),
    }),
  }),

  update: z.object({
    params: z.object({
      id: z.coerce.number(),
    }),
  }),

  bulkRead: z.object({
    body: z.object({ ids: z.array(z.number()).min(1) }).optional(),
  }),

  remove: z.object({
    params: z.object({
      id: z.coerce.number(),
    }),
  }),

  removeMany: z.object({
    body: z.object({
      ids: z
        .array(z.number(), {
          error: 'Daftar ID harus dikirim',
        })
        .min(1),
    }),
  }),
};
