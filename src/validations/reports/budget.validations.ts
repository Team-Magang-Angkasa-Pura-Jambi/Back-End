import z from 'zod';

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
        }),
      )
      .optional(),
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
export const prepareBudgetSchema = z.object({
  params: z.object({
    parentBudgetId: z.coerce.number().int().positive('ID Anggaran Induk tidak valid'),
  }),
});
