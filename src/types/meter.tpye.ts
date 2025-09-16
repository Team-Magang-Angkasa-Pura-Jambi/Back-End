import type { MeterStatus } from "../generated/prisma/index.js";

/**
 * Tipe data untuk body request saat membuat meteran baru.
 */
export type CreateMeterBody = {
  meter_code: string;
  location?: string;
  status?: MeterStatus;
  energy_type_id: number;
};

/**
 * Tipe data untuk body request saat memperbarui meteran.
 * Semua field bersifat opsional.
 */
export type UpdateMeterBody = Partial<CreateMeterBody>;

/**
 * Tipe data untuk parameter URL yang berisi ID.
 */
export type IdParams = {
  id: string;
};
