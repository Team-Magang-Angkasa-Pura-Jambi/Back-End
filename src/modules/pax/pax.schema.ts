import { z } from 'zod';

export const paxSchema = {
  store: z.object({
    body: z.object({
      date: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Format tanggal tidak valid (gunakan ISO 8601)',
      }),
      pax_count: z.number().int().min(0, 'Jumlah pax tidak boleh negatif'),
      location_id: z.number().int().positive().optional().nullable(),
      session_id: z.number().int().positive().optional().nullable(),
    }),
  }),

  update: z.object({
    params: z.object({
      id: z.string().transform((val) => parseInt(val, 10)),
    }),
    body: z.object({
      date: z.string().optional(),
      pax_count: z.number().int().min(0).optional(),
      location_id: z.number().int().positive().optional().nullable(),
      session_id: z.number().int().positive().optional().nullable(),
    }),
  }),

  show: z.object({
    query: z.object({
      start_date: z.coerce.date().optional(),
      end_date: z.coerce.date().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    }),
  }),

  detail: z.object({
    params: z.object({
      id: z.string().transform((val) => parseInt(val, 10)),
    }),
  }),
};

export type PaxQuery = z.infer<typeof paxSchema.show>['query'];
