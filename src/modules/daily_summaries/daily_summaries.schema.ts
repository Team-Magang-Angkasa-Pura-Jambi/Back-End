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
};
