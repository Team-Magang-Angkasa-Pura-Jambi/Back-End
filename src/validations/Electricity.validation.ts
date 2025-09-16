import { z } from 'zod';

/**
 * Skema untuk memvalidasi data detail pembacaan.
 */
const readingDetailSchema = z.object({
  // Menggunakan z.coerce.number untuk konversi otomatis dari string ke angka
  // dan menyederhanakan pesan error untuk menghindari bug di versi Zod Anda.
  // Zod akan tetap memberikan pesan error default jika field ini tidak diisi.
  reading_type_id: z.coerce.number({
    error: 'ID jenis pembacaan harus berupa angka.',
  }),
  value: z.coerce.number({
    error: 'Nilai pembacaan harus berupa angka.',
  }),
});

/**
 * Skema untuk memvalidasi data saat membuat sesi pembacaan baru.
 */
export const createReadingSessionSchema = z.object({
  body: z.object({
    meter_id: z.coerce.number({
      error: 'ID meteran harus berupa angka.',
    }),
    user_id: z.coerce.number({
      error: 'ID pengguna harus berupa angka.',
    }),
    timestamp: z
      .string({ error: 'Timestamp wajib diisi.' })
      .datetime({ message: 'Format timestamp tidak valid (ISO 8601).' }),
    details: z
      .array(readingDetailSchema)
      .nonempty({ message: 'Detail pembacaan tidak boleh kosong.' }),
  }),
});
