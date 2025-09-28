import { z } from 'zod';

export const getAnalysisSchema = z.object({
  query: z.object({
    energyType: z.enum(['Water', 'Electricity', 'Fuel']),

    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM')
      .optional(),
  }),
});
