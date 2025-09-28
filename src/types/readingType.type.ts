import { z } from 'zod';
import type {
  queryGetByMeter,
  readingTypeSchema,
} from '../validations/readingType.validation.js';

export type CreateReadingTypeBody = z.infer<typeof readingTypeSchema.body>;

export type UpdateReadingTypeBody = z.infer<
  typeof readingTypeSchema.bodyPartial
>;

export type ReadingTypeParams = z.infer<typeof readingTypeSchema.params>;

export type GetReadingTypesQuery = z.infer<typeof readingTypeSchema.listQuery>;
export type GetQueryMeterId = z.infer<typeof queryGetByMeter>['query'];
