import { z } from 'zod';
import type { UsageCategory } from '../generated/prisma/index.js';
import { getRecapSchema } from '../validations/reports/recap.validation.js';

// Tipe untuk query yang sudah divalidasi
export type GetRecapQuery = z.infer<typeof getRecapSchema>['query'];

// Tipe untuk setiap baris data di dalam tabel
export interface RecapDataRow {
  date: Date;
  target: number | null;
  wbp: number | null;
  lwbp: number | null;
  consumption: number | null; // PERBAIKAN: Tambahkan properti consumption
  classification: UsageCategory | null;
  confidence_score?: number | null; // BARU: Tambahkan confidence score dari klasifikasi
  prediction?: number | {} | null; // BARU: Tambahkan data prediksi
  pax: number | {} | null;
  cost: number | null;
  // BARU: Tambahkan properti untuk data suhu dan hari kerja
  avg_temp?: number | null;
  max_temp?: number | null;
  is_workday?: boolean;
  // BARU: Tambahkan properti untuk sisa stok BBM
  remaining_stock?: number | null;
}

export interface RecapSummary {
  /** The total financial cost for the entire period. */
  totalCost: number;

  /** The total financial cost for the entire period before tax. */
  totalCostBeforeTax: number;

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
  meta: RecapSummary;
}
