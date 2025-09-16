import { z } from 'zod';

// Skema untuk membuat jenis energi baru
export const createEnergyTypeSchema = z.object({
  body: z.object({
    type_name: z.string({
      error: 'Nama jenis energi wajib diisi.',
    }),
    unit_of_measurement: z.string({
      error: 'Satuan pengukuran wajib diisi.',
    }),
  }),
});

// Skema untuk memperbarui jenis energi
export const updateEnergyTypeSchema = z.object({
  body: z.object({
    type_name: z.string().optional(),
    unit_of_measurement: z.string().optional(),
  }),
});

// Mengekstrak tipe data dari skema untuk digunakan di service/controller
export type CreateEnergyTypeInput = z.infer<
  typeof createEnergyTypeSchema
>['body'];
export type UpdateEnergyTypeInput = z.infer<
  typeof updateEnergyTypeSchema
>['body'];
