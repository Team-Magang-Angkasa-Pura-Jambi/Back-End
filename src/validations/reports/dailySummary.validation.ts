import z from 'zod';
import { isoDate, positiveInt, positiveNumber } from '../../utils/schmeHelper.js';
import { CrudSchemaBuilder } from '../../utils/shemaHandler.js';

const defaultScheme = z.object({
  summary_date: isoDate('summary date'),
  total_pax: positiveInt('total pax'),
  total_cost: positiveNumber('total cost'),
  meter_id: positiveInt('meter id'),
});

const defaultParams = z.object({
  summaryId: positiveInt('summary Id'),
});

export const summaryScheme = new CrudSchemaBuilder({
  bodySchema: defaultScheme,
  paramsSchema: defaultParams,
});

const summaryDetailQueryFilters = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM')
    .optional(),
  meterId: positiveInt('meter id'),
});

export const getMonthlyReportSchema = z.object({
  // Kita bungkus dalam 'query' karena data berasal dari req.query
  query: z.object({
    year: z.coerce // z.coerce akan otomatis mengubah string dari query param menjadi number
      .number({ error: 'Tahun harus berupa angka' })
      .int()
      .min(2000, 'Tahun tidak boleh kurang dari 2000')
      .max(2100, 'Tahun tidak boleh lebih dari 2100'),
    month: z.coerce
      .number({ error: 'Bulan harus berupa angka' })
      .int()
      .min(1, 'Bulan harus antara 1 dan 12')
      .max(12, 'Bulan harus antara 1 dan 12'),
  }),
});
// Gabungkan filter kustom dengan metode getList dari builder Anda
export const querySchema = summaryScheme.getList(summaryDetailQueryFilters);
