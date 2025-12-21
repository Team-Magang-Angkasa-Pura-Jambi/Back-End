import { z } from 'zod';
import type {
  meterSchema,
  queryMeter,
} from '../../validations/metering/meter.validation.js';

export type CreateMeterBody = z.infer<typeof meterSchema.body>;

export type UpdateMeterBody = z.infer<typeof meterSchema.bodyPartial>;

export type MeterParams = z.infer<typeof meterSchema.params>;

export type GetMetersQuery = z.infer<typeof queryMeter>['query'];
