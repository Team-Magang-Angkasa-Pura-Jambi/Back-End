import { z } from 'zod';

export const configShape = {
  meter_id: z.coerce.number({ error: 'ID Meter wajib diisi' }),
  reading_type_id: z.coerce.number({ error: 'ID Reading Type wajib diisi' }),
  is_active: z.boolean().default(true),
  alarm_min_threshold: z.coerce.number().optional().nullable(),
  alarm_max_threshold: z.coerce.number().optional().nullable(),
};

export const configSchema = {
  store: z.object({
    body: z.object({
      config: z.object(configShape),
    }),
  }),

  show: z.object({
    params: z.object({
      id: z.coerce.number().optional(),
    }),
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      meter_id: z.coerce.number().optional(),
      reading_type_id: z.coerce.number().optional(),
      is_active: z
        .enum(['true', 'false'])
        .optional()
        .transform((val) => (val === undefined ? undefined : val === 'true')),
    }),
  }),

  patch: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID Config wajib diisi' }),
    }),
    body: z.object({
      config: z.object(configShape).partial(),
    }),
  }),

  remove: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID Config wajib diisi' }),
    }),
  }),
};
