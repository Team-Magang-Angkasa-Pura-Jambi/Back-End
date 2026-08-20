import { z } from 'zod';

export const runEvaluationSchema = z.object({
  body: z.object({
    meter_id: z.coerce
      .number({ error: 'meter_id wajib diisi' })
      .int('meter_id harus berupa angka bulat')
      .positive('meter_id tidak boleh minus atau nol'),

    summary_id: z.coerce
      .number({ error: 'summary_id wajib diisi' })
      .int('summary_id harus berupa angka bulat')
      .positive('summary_id tidak boleh minus atau nol'),

    suhu_rata: z.coerce.number().optional(),
    suhu_max: z.coerce.number().optional(),

    pax: z.coerce
      .number()
      .int('pax harus berupa angka bulat')
      .nonnegative('pax tidak boleh minus')
      .optional(),

    is_hari_kerja: z.coerce
      .number()
      .int()
      .min(0, 'is_hari_kerja hanya boleh 0 (libur) atau 1 (kerja)')
      .max(1, 'is_hari_kerja hanya boleh 0 (libur) atau 1 (kerja)')
      .optional(),
  }),
});
