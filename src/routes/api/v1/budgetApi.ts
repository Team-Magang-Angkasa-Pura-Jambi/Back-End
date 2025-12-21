import { api } from '@/lib/api'; // Asumsi Anda punya instance axios yang sudah dikonfigurasi

/**
 * Tipe data untuk alokasi anggaran bulanan yang diterima dari backend.
 */
export type MonthlyBudgetAllocation = {
  month: number;
  monthName: string;
  allocatedBudget: number;
  realizationCost: number;
  remainingBudget: number;
  realizationPercentage: number | null;
};

/**
 * BARU: Tipe data untuk ringkasan anggaran per jenis energi.
 */
export type BudgetSummaryByEnergy = {
  energyTypeId: number;
  energyTypeName: string;
  budgetThisYear: number;
  currentPeriod: {
    budgetId: number;
    periodStart: string; // ISO Date String
    periodEnd: string; // ISO Date String
    totalBudget: number;
    totalRealization: number;
    remainingBudget: number;
    realizationPercentage: number | null;
  } | null;
};

/**
 * Tipe data untuk payload saat memproses anggaran.
 */
export type ProcessBudgetPayload = {
  pjj_rate: number;
  process_date?: string; // Format: "YYYY-MM-DD"
};

/**
 * Mengambil data alokasi anggaran bulanan dari backend.
 * Berinteraksi dengan: GET /api/v1/analysis/budget-allocation
 *
 * @param year Tahun yang akan dianalisis.
 * @returns Promise yang berisi array data alokasi anggaran bulanan.
 */
export const getBudgetAllocationApi = async (
  year: number
): Promise<MonthlyBudgetAllocation[]> => {
  const response = await api.get('/analysis/budget-allocation', {
    params: { year },
  });
  // Biasanya, data ada di dalam `response.data.data` jika menggunakan wrapper `res200`
  return response.data.data;
};

/**
 * Memicu proses kalkulasi ulang anggaran di backend.
 * Berinteraksi dengan: POST /api/v1/budget/process
 *
 * @param payload Data yang dibutuhkan untuk proses, seperti pjj_rate.
 * @returns Promise yang berisi hasil dari proses kalkulasi.
 */
export const processBudgetApi = async (payload: ProcessBudgetPayload) => {
  const response = await api.post('/budget/process', payload);
  return response.data;
};

/**
 * BARU: Mengambil data ringkasan anggaran per jenis energi.
 * Berinteraksi dengan: GET /api/v1/analysis/budget-summary
 *
 * @returns Promise yang berisi array data ringkasan anggaran.
 */

