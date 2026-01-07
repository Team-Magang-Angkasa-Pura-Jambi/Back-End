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
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    meterId: z.coerce
      .number()
      .int()
      .positive('meterId harus berupa angka positif'),
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

export const budgetPreviewSchema = z.object({
  body: z.object({
    parent_budget_id: z.coerce.number().int().positive(),
    period_start: z.coerce.date(),
    period_end: z.coerce.date(),

    allocations: z
      .array(
        z.object({
          meter_id: z.coerce.number().int().positive(),
          weight: z.coerce.number().min(0).max(1),
        })
      )
      .optional(),
  }),
});

export const efficiencyTargetPreviewSchema = z.object({
  body: z.object({
    target_value: z.coerce
      .number()
      .positive('Target value must be greater than 0'),
    meter_id: z.coerce.number().int().positive('Invalid Meter ID'),
    period_start: z.coerce.date({
      error: () => ({ message: 'Format tanggal mulai tidak valid' }),
    }),
    period_end: z.coerce.date({
      error: () => ({ message: 'Format tanggal akhir tidak valid' }),
    }),
  }),
});

export const prepareBudgetSchema = z.object({
  params: z.object({
    parentBudgetId: z.coerce
      .number()
      .int()
      .positive('ID Anggaran Induk tidak valid'),
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

export const getBudgetSummarySchema = z.object({
  query: z.object({
    year: z.coerce
      .number({ error: 'Tahun harus berupa angka' })
      .int('Tahun harus bilangan bulat')
      .min(2000, 'Tahun tidak valid (terlalu lama)')
      .max(2100, 'Tahun tidak valid (terlalu jauh)')
      .optional(), // Optional: Jika user tidak kirim, akan jadi undefined
  }),
});
