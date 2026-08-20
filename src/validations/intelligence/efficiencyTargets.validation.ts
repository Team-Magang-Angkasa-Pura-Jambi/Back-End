import { z } from 'zod';
import { positiveInt, positiveNumber, requiredString } from '../../utils/schmeHelper.js';
import { CrudSchemaBuilder } from '../../utils/shemaHandler.js';

const efficiencyBodyScheme = z
  .object({
    kpi_name: requiredString('Nama KPI').min(3, 'Nama KPI minimal 3 karakter.'),
    target_value: positiveNumber('Nilai target'),
    period_start: z.coerce.date({
      error: 'Tanggal mulai periode wajib diisi.',
    }),
    period_end: z.coerce.date({
      error: 'Tanggal akhir periode wajib diisi.',
    }),
    meter_id: positiveInt('ID meter'),
  })

  .refine((data) => data.period_end >= data.period_start, {
    message: 'Tanggal akhir periode tidak boleh lebih awal dari tanggal mulai.',
    path: ['period_end'],
  });

const efficiencyParamsSchema = z.object({
  targetId: positiveInt('ID target'),
});

export const efficiencyScheme = new CrudSchemaBuilder({
  bodySchema: efficiencyBodyScheme,
  paramsSchema: efficiencyParamsSchema,
});

export const efficiencyTargetPreviewSchema = z.object({
  body: z.object({
    target_value: z.coerce.number().positive('Target value must be greater than 0'),
    meter_id: z.coerce.number().int().positive('Invalid Meter ID'),
    period_start: z.coerce.date({
      error: () => ({ message: 'Format tanggal mulai tidak valid' }),
    }),
    period_end: z.coerce.date({
      error: () => ({ message: 'Format tanggal akhir tidak valid' }),
    }),
  }),
});
