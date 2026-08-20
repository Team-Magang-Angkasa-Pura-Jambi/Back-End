import { z } from 'zod';

export const singlePredictionSchema = z.object({
  body: z.object({
    meter_id: z.coerce.number().int().positive().optional(),
    meterId: z.coerce.number().int().positive().optional(),
    date: z.string().min(1).optional(),
    target_date: z.string().min(1).optional(),
    suhu_rata: z.coerce.number().optional(),
    suhu_max: z.coerce.number().optional(),
  }).refine((data) => data.meter_id !== undefined || data.meterId !== undefined, {
    message: 'meter_id atau meterId wajib diisi',
    path: ['meter_id'],
  }).refine((data) => data.date !== undefined || data.target_date !== undefined, {
    message: 'date atau target_date wajib diisi',
    path: ['date'],
  }),
});

export const bulkPredictionSchema = z.object({
  body: z.object({
    meter_id: z.coerce.number().int().positive().optional(),
    meterId: z.coerce.number().int().positive().optional(),
    start_date: z.string().min(1).optional(),
    startDate: z.string().min(1).optional(),
    end_date: z.string().min(1).optional(),
    endDate: z.string().min(1).optional(),
    suhu_rata: z.coerce.number().optional(),
    suhu_max: z.coerce.number().optional(),
  }).refine((data) => data.meter_id !== undefined || data.meterId !== undefined, {
    message: 'meter_id atau meterId wajib diisi',
    path: ['meter_id'],
  }).refine((data) => (data.start_date || data.startDate) && (data.end_date || data.endDate), {
    message: 'start_date dan end_date wajib diisi',
    path: ['start_date'],
  }),
});

export const queryPredictionSchema = z.object({
  query: z.object({
    meter_id: z.coerce.number().int().positive().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(30),
  }),
});
