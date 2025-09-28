import { z } from 'zod';
import type { readingDetailSchema } from '../validations/readingDetail.validations.js';

export type CreateReadingDetailBody = z.infer<typeof readingDetailSchema.body>;

export type UpdateReadingDetailBody = z.infer<
  typeof readingDetailSchema.bodyPartial
>;

export type ReadingDetailParams = z.infer<typeof readingDetailSchema.params>;

export type GetReadingDetailsQuery = z.infer<
  typeof readingDetailSchema.listQuery
>;
