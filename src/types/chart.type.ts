import type { z } from 'zod';
import type { getChartDataSchema } from '../validations/chart.validation.js';

/**
 * Tipe data untuk query parameters saat meminta data chart.
 */
export type GetChartDataQuery = z.infer<typeof getChartDataSchema>['query'];

/**
 * Tipe data untuk satu titik data dalam chart.
 */
export interface ChartDataPoint {
  date: string; // Format YYYY-MM-DD
  actual_consumption: number | null; // null jika tidak ada data
  predicted_consumption: number | null; // null jika tidak ada prediksi
  efficiency_target: number | null; // null jika tidak ada target
}
