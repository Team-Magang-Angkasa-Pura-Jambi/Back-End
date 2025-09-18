import type { z } from 'zod';
import type { getSummarySchema } from '../validations/summarry.validation.js';

/**
 * Tipe data untuk query parameters saat meminta data summary.
 * Diekstrak dari skema validasi Zod.
 */
export type GetSummaryQuery = z.infer<typeof getSummarySchema>['query'];

/**
 * Tipe data untuk struktur respons dari API summary.
 */
export interface SummaryResponse {
  period: {
    start: string;
    end: string;
  };
  summary: {
    electricity: SummaryDetail;
    water: SummaryDetail;
    fuel: SummaryDetail;
  };
}

export interface SummaryDetail {
  total_consumption: number;
  previous_period_consumption: number;
  percentage_change: number | null; // null jika data sebelumnya 0
  unit: string;
}
