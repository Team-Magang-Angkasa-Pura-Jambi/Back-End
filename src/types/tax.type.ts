import { z } from 'zod';
import type { taxSchema } from '../validations/tax.validation.js';

export type CreateTaxBody = z.infer<typeof taxSchema.body>;

export type UpdateTaxBody = z.infer<typeof taxSchema.bodyPartial>;

export type TaxParams = z.infer<typeof taxSchema.params>;

export type GetTaxQuery = z.infer<typeof taxSchema.listQuery>;
