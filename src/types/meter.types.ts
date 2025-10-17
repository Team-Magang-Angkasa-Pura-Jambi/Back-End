import type { Meter, MeterStatus } from '../generated/prisma/index.js';

// Tipe dasar untuk properti yang bisa di-query
export type GetMetersQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: MeterStatus;
  energyTypeId?: number;
  categoryId?: number;
};

// Tipe untuk body request saat membuat meter baru
export type CreateMeterBody = {
  meter_code: string;
  status?: MeterStatus;
  energy_type_id: number;
  category_id: number;
  tariff_group_id: number;
  // Properti opsional khusus untuk BBM
  tank_height_cm?: number;
  tank_volume_liters?: number;
};

// Tipe untuk body request saat memperbarui meter
// Semua properti dibuat opsional
export type UpdateMeterBody = Partial<CreateMeterBody>;

// Tipe untuk respons API yang menyertakan relasi
export type MeterWithRelations = Meter & {
  energy_type: { type_name: string };
  category: { name: string };
  tariff_group: { group_code: string };
};
