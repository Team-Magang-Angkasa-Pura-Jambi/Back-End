import { z } from 'zod';

const budgetShape = {
  fiscal_year: z.coerce.number().int().min(2000).max(2100),
  energy_type_id: z.coerce.number().int().positive(),
  name: z.string().min(1, 'Nama anggaran wajib diisi'),
  total_amount: z.coerce.number().min(0),
  efficiency_target_percentage: z.coerce.number().min(0).max(1).optional().nullable(),
  description: z.string().optional().nullable(),
};

export const budgetSchema = {
  store: z.object({
    body: z.object({
      ...budgetShape,
    }),
  }),

  show: z.object({
    params: z.object({
      id: z.coerce.number().int().optional(),
    }),
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      search: z.string().optional(),
      year: z.coerce.number().optional(),
    }),
  }),

  patch: z.object({
    params: z.object({
      id: z.coerce.number().int(),
    }),
    body: z
      .object({
        ...budgetShape,
      })
      .partial(),
  }),

  remove: z.object({
    params: z.object({
      id: z.coerce.number().int(),
    }),
  }),

  showRemaining: z.object({
    params: z.object({
      id: z.coerce.number().int(),
    }),
  }),
};
