import { z } from 'zod';

export const getAnalysisSchema = z.object({
  query: z.object({
    energyType: z.enum(['Electricity', 'Water', 'Fuel']),
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM'),
    meterId: z.coerce.number().int().positive().optional(),
  }),
});

export const bulkPredictionSchema = z.object({
  body: z.object({
    startDate: z.string().date('Tanggal mulai tidak valid.'),
    endDate: z.string().date('Tanggal akhir tidak valid.'),
  }),
});
