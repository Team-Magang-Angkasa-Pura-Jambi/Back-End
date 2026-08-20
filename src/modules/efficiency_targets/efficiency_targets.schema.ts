import z from 'zod';

export const efficiencySchema = {
  show: z.object({
    params: z.object({
      id: z.coerce.number().optional(),
    }),
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      meter_id: z.coerce.number().optional(),
      period_start: z.coerce.date().optional(),
      period_end: z.coerce.date().optional(),
      kpi_name: z.string().optional(),
    }),
  }),

  store: z.object({
    body: z
      .object({
        meter_id: z.number({ error: 'Meter ID wajib diisi' }),

        period_start: z.coerce.date({ error: 'Tanggal mulai wajib diisi' }),
        period_end: z.coerce.date({ error: 'Tanggal selesai wajib diisi' }),

        kpi_name: z.string({ error: 'Nama KPI wajib diisi' }).min(3, 'Nama KPI terlalu pendek'),

        target_percentage: z
          .number({ error: 'Target persentase wajib diisi' })
          .min(0, 'Persentase tidak boleh negatif')
          .max(1, 'Gunakan desimal (0.0 - 1.0) untuk persentase. Contoh: 0.15 untuk 15%'),

        baseline_value: z
          .number({ error: 'Nilai baseline wajib diisi' })
          .min(0, 'Baseline tidak boleh negatif'),
      })
      .refine((data) => data.period_end > data.period_start, {
        message: 'Tanggal selesai harus lebih besar dari tanggal mulai',
        path: ['period_end'],
      }),
  }),

  update: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID Target harus diisi' }),
    }),
    body: z
      .object({
        meter_id: z.number().optional(),
        period_start: z.coerce.date().optional(),
        period_end: z.coerce.date().optional(),
        kpi_name: z.string().optional(),
        target_percentage: z.number().min(0).max(1).optional(),
        baseline_value: z.number().min(0).optional(),
      })
      .refine(
        (data) => {
          if (data.period_start && data.period_end) {
            return data.period_end > data.period_start;
          }
          return true;
        },
        {
          message: 'Tanggal selesai harus lebih besar dari tanggal mulai',
          path: ['period_end'],
        },
      ),
  }),

  remove: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID Target harus diisi' }),
    }),
  }),
  // previewEfficiency: z.object({
  //   body: z.object({
  //     meter_id: z.number({ error: 'Meter ID wajib diisi' }),
  //     target_percentage: z.number({ error: 'Target persentase wajib diisi' }),
  //   }),
  // }),
};
