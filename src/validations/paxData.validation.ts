import z from 'zod';
import { isoDate, positiveInt } from '../utils/schmeHelper.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';

const defaultSchema = z.object({
  data_date: isoDate('data date'),
  total_pax: positiveInt('total pax'),
});

const defaultParams = z.object({
  paxId: positiveInt('pax ID'),
});

export const paxScheme = new CrudSchemaBuilder({
  bodySchema: defaultSchema,
  paramsSchema: defaultParams,
});
