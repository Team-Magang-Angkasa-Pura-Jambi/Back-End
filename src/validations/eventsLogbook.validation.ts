import z from 'zod';
import { isoDate, positiveInt, requiredString } from '../utils/schmeHelper.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';

const defaultSchema = z.object({
  event_timestamp: isoDate('event timestamp'),
  notes: requiredString('notes'),
});

const defaultParams = z.object({
  eventId: positiveInt('event Id'),
});

export const logBookScheme = new CrudSchemaBuilder({
  bodySchema: defaultSchema,
  paramsSchema: defaultParams,
});
