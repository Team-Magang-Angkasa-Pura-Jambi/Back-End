import z from 'zod';
import { positiveInt, positiveNumber, requiredString } from '../../utils/schmeHelper.js';
import { CrudSchemaBuilder } from '../../utils/shemaHandler.js';

const defaultScheme = z.object({
  metric_name: requiredString('matric name'),
  metric_value: positiveNumber('metric_value'),
  summary_id: positiveInt('summary Id'),
});

const params = z.object({
  detailId: positiveInt('detail Id'),
});

export const summaryDetailScheme = new CrudSchemaBuilder({
  bodySchema: defaultScheme,
  paramsSchema: params,
});

const summaryDetailQueryFilters = z.object({
  /**
   * Filter berdasarkan bulan dan tahun.
   * Format yang diharapkan adalah YYYY-MM (contoh: "2025-10").
   */
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM')
    .optional(),
});

// Gabungkan filter kustom dengan metode getList dari builder Anda
export const querySchema = summaryDetailScheme.getList(summaryDetailQueryFilters);
