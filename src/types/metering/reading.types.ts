import { z } from 'zod';
import type {
  getReadingsSchema,
  queryLastReading,
  readingSessionSchemas,
} from '../../validations/metering/reading.validation.js';

export type CreateReadingSessionBody = z.infer<
  typeof readingSessionSchemas.body
>;

export type UpdateReadingSessionBody = z.infer<
  typeof readingSessionSchemas.bodyPartial
>;

export type ReadingSessionParams = z.infer<typeof readingSessionSchemas.params>;

export type GetReadingSessionsQuery = z.infer<
  typeof getReadingsSchema
>['query'];

export type GetQueryLastReading = z.infer<typeof queryLastReading>['query'];
