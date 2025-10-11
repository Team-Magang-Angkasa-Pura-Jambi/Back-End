import { z } from 'zod';
import { isoDate, positiveInt } from './schmeHelper.js';

export const getLogbooksSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    startDate: isoDate('Tanggal Mulai').optional(),
    endDate: isoDate('Tanggal Selesai').optional(),
  }),
});

export const getLogbookByIdSchema = z.object({
  params: z.object({
    logId: positiveInt('ID Logbook'),
  }),
});

export const generateLogbookSchema = z.object({
  body: z.object({
    date: isoDate('Tanggal Logbook'),
  }),
});

export const updateLogbookSchema = z.object({
  params: z.object({
    logId: positiveInt('ID Logbook'),
  }),
  body: z.object({
    manual_notes: z
      .string()
      .min(1, 'Catatan manual tidak boleh kosong.')
      .trim(),
  }),
});

export const deleteLogbookSchema = z.object({
  params: z.object({
    logId: positiveInt('ID Logbook'),
  }),
});
