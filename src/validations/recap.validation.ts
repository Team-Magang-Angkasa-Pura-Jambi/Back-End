import { z } from 'zod';

export const getRecapSchema = z.object({
  query: z.object({
    energyType: z.enum(['Electricity', 'Water', 'Fuel']),
    startDate: z.coerce.date({ error: 'Tanggal mulai wajib diisi.' }),
    endDate: z.coerce.date({ error: 'Tanggal akhir wajib diisi.' }),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});
