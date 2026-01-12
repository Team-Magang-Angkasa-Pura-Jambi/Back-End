import { type z } from 'zod';
import {
  type queryGetByMeter,
  type readingTypeSchema,
} from '../../validations/metering/readingType.validation.js';

export type CreateReadingTypeBody = z.infer<typeof readingTypeSchema.body>;

export type UpdateReadingTypeBody = z.infer<typeof readingTypeSchema.bodyPartial>;

export type ReadingTypeParams = z.infer<typeof readingTypeSchema.params>;

export type GetReadingTypesQuery = z.infer<typeof readingTypeSchema.listQuery>;
export type GetQueryMeterId = z.infer<typeof queryGetByMeter>['query'];
