import { z } from 'zod';

/**
 * Skema untuk memvalidasi query parameters pada endpoint summary.
 * startDate dan endDate bersifat opsional.
 */
export const getSummarySchema = z.object({
  query: z
    .object({
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
        // Pastikan jika kedua tanggal ada, endDate tidak lebih dulu dari startDate
        if (data.startDate && data.endDate) {
          return new Date(data.endDate) >= new Date(data.startDate);
        }
        return true;
      },
      {
        message: 'endDate tidak boleh lebih awal dari startDate.',
        path: ['endDate'], // Tunjukkan error pada field endDate
      }
    ),
});
