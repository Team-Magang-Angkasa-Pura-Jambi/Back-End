import type { Prisma } from '../generated/prisma';

/**
 * Tipe data untuk satu item alokasi anggaran ke meteran.
 * Digunakan dalam array saat membuat atau memperbarui anggaran.
 */
export type AllocationData = {
  meter_id: number;
  weight: number;
};

/**
 * Tipe data untuk body request saat membuat AnnualBudget baru.
 * Ini mencakup data anggaran utama dan array alokasinya.
 * Tipe ini diturunkan dari skema Zod untuk memastikan konsistensi.
 */
export type CreateAnnualBudgetBody = Omit<
  Prisma.AnnualBudgetCreateInput,
  'energy_type' | 'allocations'
> & {
  allocations: AllocationData[];
  energy_type_id: number;
};

/**
 * Tipe data untuk body request saat memperbarui AnnualBudget.
 * Semua properti bersifat opsional.
 */
export type UpdateAnnualBudgetBody = Partial<CreateAnnualBudgetBody>;

/**
 * Tipe data untuk query parameter saat mengambil daftar AnnualBudget.
 */
export type GetAnnualBudgetQuery = {
  date?: string; // Format YYYY-MM-DD
};
