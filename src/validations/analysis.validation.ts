import { z } from 'zod';
import { positiveInt } from './schmeHelper.js';

export const getAnalysisSchema = z.object({
  query: z.object({
    energyType: z.enum(['Water', 'Electricity', 'Fuel']),
    meterId: positiveInt('meterId'),
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM')
      .optional(),
  }),
});
