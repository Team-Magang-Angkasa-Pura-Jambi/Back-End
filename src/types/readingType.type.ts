import type { z } from 'zod';
import type {
  createReadingTypeSchema,
  updateReadingTypeSchema,
} from '../validations/readingType.validation.js';

/**
 * Tipe data untuk body request saat membuat tipe pembacaan baru.
 */
export type CreateReadingTypeInput = z.infer<
  typeof createReadingTypeSchema
>['body'];

/**
 * Tipe data untuk body request saat memperbarui tipe pembacaan.
 */
export type UpdateReadingTypeInput = z.infer<
  typeof updateReadingTypeSchema
>['body'];
