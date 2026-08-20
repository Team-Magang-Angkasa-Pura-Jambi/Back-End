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

export const analysisQuerySchema = z.object({
  query: z.object({
    energyType: z.enum(['Electricity', 'Water', 'Fuel']),
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM'),
    meterId: z.coerce.number().int().positive().optional(),
  }),
});

export const singlePredictionSchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    meterId: z.coerce.number().int().positive('meterId harus berupa angka positif'),
  }),
});

export const classificationSummaryQuerySchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM'),
  }),
});

export const fuelStockAnalysisQuerySchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM'),
  }),
});

export const todaySummaryQuerySchema = z.object({
  query: z.object({
    energyType: z.enum(['Electricity', 'Water', 'Fuel']).optional(),
  }),
});

export const budgetAllocationQuerySchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(2100),
  }),
});

export const monthlyRecapSchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    energyType: z.enum(['Electricity', 'Water', 'Fuel']),
    meterId: z.coerce.number().int().positive().optional(),
  }),
});
