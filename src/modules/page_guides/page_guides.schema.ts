import { z } from 'zod';

export const pageGuidesSchema = {
  show: z.object({
    query: z.object({
      route: z
        .string({ error: 'Parameter route harus diisi' })
        .min(1, 'Parameter route tidak boleh kosong'),
    }),
  }),

  create: z.object({
    body: z.object({
      route: z.string({ error: 'Route harus diisi' }),
      title: z.string({ error: 'Title harus diisi' }),
      subtitle: z.string().optional(),
      icon_name: z.string().optional(),
      overview: z.string().optional(),
      target_users: z.string().optional(),
      workflow: z.array(z.any()).optional().default([]),
      buttons: z.array(z.any()).optional().default([]),
      tips: z.array(z.string()).optional().default([]),
      is_active: z.boolean().optional().default(true),
    }),
  }),

  patch: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID Guide harus berupa angka' }),
    }),
    body: z.object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      icon_name: z.string().optional(),
      overview: z.string().optional(),
      target_users: z.string().optional(),
      workflow: z.array(z.any()).optional(),
      buttons: z.array(z.any()).optional(),
      tips: z.array(z.string()).optional(),
      is_active: z.boolean().optional(),
    }),
  }),
};

export type UpdatePageGuidePayload = z.infer<typeof pageGuidesSchema.patch>['body'];
