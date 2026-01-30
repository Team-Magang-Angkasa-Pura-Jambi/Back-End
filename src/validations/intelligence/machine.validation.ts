import { z } from 'zod';

export const singleDateSchema = z.object({
  body: z.object({
    date: z.string({ error: 'Date is required' }).date('Invalid date format. Expected YYYY-MM-DD'), // Validasi format YYYY-MM-DD

    meter_id: z.coerce
      .number({ error: 'Meter ID is required' })
      .int('Meter ID must be an integer')
      .positive('Meter ID must be a positive number'),
  }),
});

// --- SCHEMA 2: BULK (Range Prediction) ---
// Digunakan untuk: /predict/bulk
export const bulkDateSchema = z.object({
  body: z
    .object({
      start_date: z
        .string({ error: 'Start Date is required' })
        .date('Invalid date format. Expected YYYY-MM-DD'),

      end_date: z
        .string({ error: 'End Date is required' })
        .date('Invalid date format. Expected YYYY-MM-DD'),

      meter_id: z.coerce.number({ error: 'Meter ID is required' }).int().positive(),
    })
    .refine((data) => new Date(data.end_date) >= new Date(data.start_date), {
      message: 'End date must be greater than or equal to start date',
      path: ['end_date'], // Error akan muncul di field end_date
    }),
});
