import { z } from 'zod';

export const visualizationSchema = {
  metricCards: z.object({
    query: z.object({
      year: z.coerce
        .number()
        .int({ message: 'Tahun harus berupa bilangan bulat' })
        .min(2000, { message: 'Tahun minimal 2000' })
        .max(2100, { message: 'Tahun maksimal 2100' })
        .optional(),

      month: z.coerce
        .number()
        .int({ message: 'Bulan harus berupa bilangan bulat' })
        .min(1, { message: 'Bulan minimal 1 (Januari)' })
        .max(12, { message: 'Bulan maksimal 12 (Desember)' })
        .optional(),
    }),
  }),
  yearlyHeatmap: z.object({
    query: z.object({
      meterId: z.coerce
        .number({
          error: 'ID Meter wajib disertakan',
        })
        .int({ message: 'ID Meter harus berupa bilangan bulat' })
        .positive({ message: 'ID Meter tidak valid' }),

      year: z.coerce
        .number({
          error: 'Tahun wajib disertakan',
        })
        .int({ message: 'Tahun harus berupa bilangan bulat' })
        .min(2000, { message: 'Tahun minimal 2000' })
        .max(2100, { message: 'Tahun maksimal 2100' }),
    }),
  }),

  yearlyAnalysis: z.object({
    query: z.object({
      energyId: z.coerce
        .number({
          error: 'ID Meter wajib disertakan',
        })
        .int({ message: 'ID Meter harus berupa bilangan bulat' })
        .positive({ message: 'ID Meter tidak valid' }),

      year: z.coerce
        .number({
          error: 'Tahun wajib disertakan',
        })
        .int({ message: 'Tahun harus berupa bilangan bulat' })
        .min(2000, { message: 'Tahun minimal 2000' })
        .max(2100, { message: 'Tahun maksimal 2100' }),
    }),
  }),
  trentConsumption: z.object({
    query: z.object({
      energyId: z.coerce
        .number({
          error: 'ID Energi wajib disertakan',
        })
        .int({ message: 'ID Energi harus bilangan bulat' })
        .positive({ message: 'ID Energi harus lebih dari 0' }),

      year: z.coerce
        .number({
          error: 'Tahun wajib disertakan',
        })
        .int()
        .min(2000, { message: 'Tahun minimal 2000' })
        .max(2100, { message: 'Tahun maksimal 2100' }),

      month: z.coerce
        .number({
          error: 'Bulan wajib disertakan',
        })
        .int()
        .min(1, { message: 'Bulan minimal 1 (Januari)' })
        .max(12, { message: 'Bulan maksimal 12 (Desember)' }),

      meterId: z.coerce
        .number({ error: 'ID Meter harus berupa angka' })
        .int()
        .positive()
        .optional(), // Opsional: Boleh ada, boleh tidak
    }),
  }),
  getEnergyPaxCorrelation: z.object({
    query: z.object({
      year: z.coerce
        .number({
          error: 'Tahun wajib disertakan',
        })
        .int()
        .min(2000, { message: 'Tahun minimal 2000' })
        .max(2100, { message: 'Tahun maksimal 2100' }),

      month: z.coerce
        .number({
          error: 'Bulan wajib disertakan',
        })
        .int()
        .min(1, { message: 'Bulan minimal 1 (Januari)' })
        .max(12, { message: 'Bulan maksimal 12 (Desember)' }),
    }),
  }),
  getYearlyLogistics: z.object({
    query: z.object({
      meterId: z.coerce
        .number({
          error: 'ID Tangki (Meter) wajib disertakan',
        })
        .int(),
      year: z.coerce
        .number({
          error: 'Tahun analisis wajib disertakan',
        })
        .int()
        .min(2000)
        .max(2100),
    }),
  }),
  GetTodaySummaryQuerySchema: z.object({
    query: z.object({
      // Ubah string dari query URL menjadi number, opsional jika tidak ada filter
      energyId: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : undefined))
        .refine((val) => val === undefined || !isNaN(val), {
          message: 'energyId harus berupa angka yang valid',
        }),
    }),
  }),
  updateDashboardCardConfig: z.object({
    body: z.object({
      cards: z
        .object({
          electricity: z
            .object({
              show: z.boolean().optional().default(true),
              title: z.string().optional(),
              meterIds: z.array(z.coerce.number().int().positive()).optional().default([]),
            })
            .optional(),
          water: z
            .object({
              show: z.boolean().optional().default(true),
              title: z.string().optional(),
              meterIds: z.array(z.coerce.number().int().positive()).optional().default([]),
            })
            .optional(),
          fuel: z
            .object({
              show: z.boolean().optional().default(true),
              title: z.string().optional(),
              meterIds: z.array(z.coerce.number().int().positive()).optional().default([]),
            })
            .optional(),
          pax: z
            .object({
              show: z.boolean().optional().default(true),
              title: z.string().optional(),
            })
            .optional(),
          weather: z
            .object({
              show: z.boolean().optional().default(true),
              title: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
      yearly_heatmap: z
        .object({
          show: z.boolean().optional().default(true),
          title: z.string().optional(),
          meter_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
          default_meter_id: z.coerce.number().int().positive().nullable().optional(),
        })
        .optional(),
      trend_analysis: z
        .object({
          show: z.boolean().optional().default(true),
          title: z.string().optional(),
          meter_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
          default_energy_id: z.coerce.number().int().positive().optional().default(1),
          default_meter_id: z.coerce.number().int().positive().nullable().optional(),
        })
        .optional(),
      fuel_logistics: z
        .object({
          show: z.boolean().optional().default(true),
          title: z.string().optional(),
          meter_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
          default_meter_id: z.coerce.number().int().positive().nullable().optional(),
        })
        .optional(),
      yearly_spending: z
        .object({
          show: z.boolean().optional().default(true),
          title: z.string().optional(),
          default_energy_id: z.coerce.number().int().positive().optional().default(1),
        })
        .optional(),
      pax_correlation: z
        .object({
          show: z.boolean().optional().default(true),
          title: z.string().optional(),
          default_energy_id: z.coerce.number().int().positive().optional().default(1),
        })
        .optional(),
      electricity: z.any().optional(),
      water: z.any().optional(),
      fuel: z.any().optional(),
      pax: z.any().optional(),
      weather: z.any().optional(),
      electricityMeterIds: z.array(z.coerce.number().int().positive()).optional(),
      waterMeterIds: z.array(z.coerce.number().int().positive()).optional(),
      fuelMeterIds: z.array(z.coerce.number().int().positive()).optional(),
    }).passthrough(),
  }),
};
