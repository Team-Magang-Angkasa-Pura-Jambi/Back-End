import { z } from 'zod';

/**
 * Skema untuk memvalidasi data saat membuat tipe pembacaan baru.
 */
export const createReadingTypeSchema = z.object({
  body: z.object({
    type_name: z
      .string({
        error: 'Nama tipe wajib diisi.',
      })
      .min(1, 'Nama tipe tidak boleh kosong.'),
    energy_type_id: z
      .number({
        error: 'ID Jenis Energi wajib diisi.',
      })
      .int()
      .positive(),
  }),
});

/**
 * Skema untuk memvalidasi data saat memperbarui tipe pembacaan.
 * Semua field bersifat opsional.
 */
export const updateReadingTypeSchema = z.object({
  body: z.object({
    type_name: z.string().min(1, 'Nama tipe tidak boleh kosong.').optional(),
    energy_type_id: z.number().int().positive().optional(),
  }),
});
