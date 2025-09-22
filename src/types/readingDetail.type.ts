// src/types/priceScheme.type.ts

import { z } from 'zod';
// Impor skema validasi yang telah kita buat
import {
  createPriceSchemeSchema,
  updatePriceSchemeSchema,
  priceSchemeParamsSchema,
} from '../validations/priceSchema.validation.js';

/**
 * Tipe untuk body request saat membuat PriceScheme baru.
 * Tipe ini dibuat secara otomatis dari `createPriceSchemeSchema`.
 */
export type PriceSchemeCreateInput = z.infer<
  typeof createPriceSchemeSchema
>['body'];

/**
 * Tipe untuk body request saat memperbarui PriceScheme.
 * Tipe ini dibuat secara otomatis dari `updatePriceSchemeSchema`.
 */
export type PriceSchemeUpdateInput = z.infer<
  typeof updatePriceSchemeSchema
>['body'];

/**
 * Tipe untuk parameter URL (:scheme_id).
 * Tipe ini dibuat secara otomatis dari `priceSchemeParamsSchema`.
 */
export type PriceSchemeParams = z.infer<
  typeof priceSchemeParamsSchema
>['params'];
