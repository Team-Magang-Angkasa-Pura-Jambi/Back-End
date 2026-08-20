import { z } from 'zod';

export const dailySummarySchema = {
  show: z.object({
    query: z.object({
      meter_id: z.coerce.number().optional(),
      from_date: z.string().optional(),
      to_date: z.string().optional(),
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
    }),
  }),

  // Schema baru khusus untuk endpoint /recap
  recap: z.object({
    query: z.object({
      energyType: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      // Menerima input "all" (string) ataupun id meter (number)
      meterId: z.union([z.coerce.number(), z.literal('all')]).optional(),
    }),
  }),
};
