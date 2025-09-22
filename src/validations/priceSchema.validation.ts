// src/validations/priceScheme.validations.ts
import { z } from 'zod';

// Hapus `createCrudSchemas` dan `idParamSchema` karena kita akan definisikan secara eksplisit.


// ===== DEFINISI SKEMA DASAR =====

// Skema untuk body saat membuat Price Scheme baru
const createBodySchema = z.object({
  scheme_name: z
    .string({ error: 'Nama skema wajib diisi.' })
    .trim()
    .min(3, 'Nama skema minimal 3 karakter'),

  effective_date: z.coerce.date({
    error: 'Tanggal efektif wajib diisi.',
  }),

  is_active: z.boolean().optional().default(true),

  energy_type_id: z
    .number({ error: 'ID tipe energi wajib diisi.' })
    .int()
    .positive('ID tipe energi harus berupa angka positif.'),

  // Catatan: `set_by_user_id` biasanya didapat dari info user yang login (misal: req.user.id),
  // bukan dari body request untuk keamanan. Jika harus dari body, Anda bisa tambahkan di sini.
});

// Skema untuk parameter URL yang berisi ID
const paramsSchema = z.object({
  scheme_id: z.coerce
    .number({ error: 'ID skema harus berupa angka.' })
    .int()
    .positive('ID skema tidak valid.'),
});

// ===== EKSPOR SKEMA FINAL UNTUK ROUTER =====

/**
 * Skema untuk validasi endpoint `POST /price-schemes`
 */
export const createPriceSchemeSchema = z.object({
  body: createBodySchema,
});

/**
 * Skema untuk validasi endpoint `PATCH /price-schemes/:scheme_id`
 */
export const updatePriceSchemeSchema = z.object({
  body: createBodySchema.partial(), // .partial() membuat semua field menjadi opsional
  params: paramsSchema,
});

/**
 * Skema untuk validasi endpoint `GET /price-schemes/:scheme_id` dan `DELETE /price-schemes/:scheme_id`
 */
export const priceSchemeParamsSchema = z.object({
  params: paramsSchema,
});
