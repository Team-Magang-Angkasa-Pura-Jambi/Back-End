import { z } from 'zod';
import type {
  priceSchema,
  queryPriceSchema,
} from '../validations/priceSchema.validation.js';

export type CreatePriceSchemaBody = z.infer<typeof priceSchema.body>;

export type UpdatePriceSchemaBody = z.infer<typeof priceSchema.bodyPartial>;

export type PriceSchemaParams = z.infer<typeof priceSchema.params>;

export type GetPriceSchemasQuery = z.infer<typeof queryPriceSchema>['query'];
