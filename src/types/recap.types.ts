import { z } from 'zod';
import { getRecapSchema } from '../validations/recap.validation.js';

// Tipe untuk query yang sudah divalidasi
export type GetRecapQuery = z.infer<typeof getRecapSchema>['query'];

// Tipe untuk setiap baris data di dalam tabel
export interface RecapDataRow {
  date: Date;
  target: number | null;
  wbp: number | null;
  lwbp: number | null;
  pax: number | null;
  cost: number | null;
}

export interface RecapSummary {
  /** The total financial cost for the entire period. */
  totalCost: number;

  /** The prorated efficiency target for the selected period. */
  totalTarget: number;

  /** The total energy consumption (WBP + LWBP for electricity, or total for others). */
  totalConsumption: number;

  /** The total WBP consumption (specifically for electricity). */
  totalWbp: number;

  /** The total LWBP consumption (specifically for electricity). */
  totalLwbp: number;
  totalPax: number;
}
// Tipe untuk keseluruhan respons API
export interface RecapApiResponse {
  data: RecapDataRow[];
  meta: {
    totalCost: number;
    totalTarget: number;
  };
}
