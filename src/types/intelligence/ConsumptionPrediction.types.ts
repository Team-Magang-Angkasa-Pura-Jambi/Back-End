import { type z } from 'zod';
import type { ConsumptionPredictionSchema } from '../../validations/intelligence/ConsumptionPrediction.validation.js';

export type CreateConsumptionPredictionBody = z.infer<typeof ConsumptionPredictionSchema.body>;

export type UpdateConsumptionPredictionSchemaBody = z.infer<
  typeof ConsumptionPredictionSchema.bodyPartial
>;

export type ConsumptionPredictionSchemaParams = z.infer<typeof ConsumptionPredictionSchema.params>;

export type GetConsumptionPredictionSchemaQuery = z.infer<
  typeof ConsumptionPredictionSchema.listQuery
>;
