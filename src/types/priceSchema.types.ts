import type z from 'zod';
import type {
  createPriceSchemeSchema,
  updatePriceSchemeSchema,
} from '../validations/priceSchema.validation.js';

export type CreatePriceSchemeInput = z.infer<
  typeof createPriceSchemeSchema
>['body'];
export type UpdatePriceSchemeInput = z.infer<typeof updatePriceSchemeSchema>;


