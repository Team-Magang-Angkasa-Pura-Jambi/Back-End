import z from 'zod';

export const getYearlyHeatmapQuery = z.object({
  query: z.object({
    // Mengubah string "1" -> number 1, pastikan integer positif
    meterId: z.coerce.number().int().positive(),

    // Mengubah string "2025" -> number 2025
    year: z.coerce
      .number()
      .int()
      .min(2000)
      // Disarankan +1 jika dashboard Anda mendukung fitur Forecast/Prediksi masa depan
      .max(new Date().getFullYear() + 1),
  }),
});
export const YearlyAnalysisQuery = z.object({
  query: z.object({
    energyTypeName: z.string(),
    year: z.coerce.number().int().min(2000),
  }),
});

export const getUnifiedComparisonSchema = z.object({
  query: z.object({
    energyTypeName: z.string().optional(),

    year: z.coerce.number().int().min(2000),

    month: z.coerce
      .number()
      .int()
      .min(1, 'Month must be at least 1 (January)')
      .max(12, 'Month must be at most 12 (December)'),
  }),
});

export const getEfficiencyRatioSchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000),
    month: z.coerce
      .number()
      .int()
      .min(1, 'Month must be at least 1 (January)')
      .max(12, 'Month must be at most 12 (December)'),
  }),
});

export const getDailyAveragePaxSchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000),
    month: z.coerce
      .number()
      .int()
      .min(1, 'Month must be at least 1 (January)')
      .max(12, 'Month must be at most 12 (December)'),
  }),
});
