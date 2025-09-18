import { z } from 'zod';

/**
 * Skema untuk memvalidasi query parameters pada endpoint chart.
 */
export const getChartDataSchema = z.object({
  query: z
    .object({
      // Wajib diisi untuk memfilter jenis energi
      energyTypeName: z.enum(['Electricity', 'Water', 'Fuel'], {
        required_error: 'energyTypeName wajib diisi.',
      }),
      startDate: z
        .string()
        .datetime({ message: 'Format startDate tidak valid.' })
        .optional(),
      endDate: z
        .string()
        .datetime({ message: 'Format endDate tidak valid.' })
        .optional(),
    })
    .refine(
      (data) => {
        if (data.startDate && data.endDate) {
          return new Date(data.endDate) >= new Date(data.startDate);
        }
        return true;
      },
      {
        message: 'endDate tidak boleh lebih awal dari startDate.',
        path: ['endDate'],
      }
    ),
});
