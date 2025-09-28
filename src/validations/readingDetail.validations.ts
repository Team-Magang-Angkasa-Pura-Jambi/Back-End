import { z } from 'zod';
import { positiveInt } from './schmeHelper.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';

export const ReadingDetailSchema = z.object({
  value: positiveInt('value'),

  session_id: positiveInt('Session Id'),

  reading_type_id: positiveInt('reading type id'),
});

export const readingDetailParamsSchema = z.object({
  detailId: positiveInt('Detail Id'),
});

export const readingDetailSchema = new CrudSchemaBuilder({
  bodySchema: ReadingDetailSchema,
  paramsSchema: readingDetailParamsSchema,
});
