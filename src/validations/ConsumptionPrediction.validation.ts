import z from 'zod';
import { positiveInt, positiveNumber } from '../utils/schmeHelper.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';

const defaultScheme = z.object({
  prediction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format tanggal harus YYYY-MM-DD',
  }),

  predicted_value: positiveNumber('prediction value').optional(),

  confidence_lower_bound: positiveNumber('confidence lower bound').optional(),

  confidence_upper_bound: positiveNumber('confidence upper bound').optional(),

  model_version: z.string().optional(), // Opsional

  meter_id: positiveInt('meter id'),
});

const params = z.object({
  predictionId: positiveInt('prediction ID'),
});

export const ConsumptionPredictionSchema = new CrudSchemaBuilder({
  bodySchema: defaultScheme,
  paramsSchema: params,
});
