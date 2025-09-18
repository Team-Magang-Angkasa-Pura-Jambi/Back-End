import { z } from 'zod';

/**
 * Skema untuk memvalidasi satu item detail pembacaan.
 */
const readingDetailSchema = z.object({
  reading_type_id: z.number().int().positive().optional(), // Dibuat opsional untuk penentuan otomatis
  value: z.number().gte(0),
});

/**
 * Skema untuk memvalidasi body saat membuat sesi pembacaan baru.
 */
export const createReadingSessionSchema = z.object({
  body: z.object({
    meter_id: z.number().int().positive(),
    user_id: z.number().int().positive().default(1),
    timestamp: z.string().datetime().default(new Date().toISOString()),
    details: z.array(readingDetailSchema).nonempty(),
  }),
});

/**
 * Skema untuk memvalidasi parameter ID dari URL.
 */
export const getByIdSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

/**
 * Skema untuk memvalidasi query parameters saat mengambil daftar pembacaan.
 * Semua field bersifat opsional.
 */
export const getReadingsSchema = z.object({
  query: z.object({
    // [REVISED] Menggunakan enum untuk memastikan nilai yang masuk valid.
    energyTypeName: z.enum(['Electricity', 'Water', 'Fuel']).optional(),
    date: z.string().datetime().optional(),
    meterId: z.coerce.number().int().positive().optional(),
    userId: z.coerce.number().int().positive().optional(),
  }),
});

/**
 * Skema untuk membuat koreksi (sama dengan create).
 */
export const createCorrectionSchema = createReadingSessionSchema;
