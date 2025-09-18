import type { z } from 'zod';
import type {
  createReadingSessionSchema,
  getByIdSchema,
  getReadingsSchema,
} from '../validations/reading.validation.js';

/**
 * Tipe data untuk body request saat membuat sesi pembacaan baru.
 */
export type CreateReadingSessionBody = z.infer<
  typeof createReadingSessionSchema
>['body'];

/**
 * Tipe data untuk parameter ID dari URL.
 */
export type IdParams = z.infer<typeof getByIdSchema>['params'];

/**
 * Tipe data untuk query parameters saat mengambil data pembacaan.
 */
export type GetReadingsQuery = z.infer<typeof getReadingsSchema>['query'];
