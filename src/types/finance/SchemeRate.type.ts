import { type z } from 'zod';
import type { schemaRateSchemas } from '../../validations/finance/SchemeRate.validation.js';

export type CreateSchemeRateBody = z.infer<typeof schemaRateSchemas.body>;

export type UpdateSchemeRateBody = z.infer<typeof schemaRateSchemas.bodyPartial>;

export type SchemeRateParams = z.infer<typeof schemaRateSchemas.params>;

export type GetSchemeRateQuery = z.infer<typeof schemaRateSchemas.listQuery>;
