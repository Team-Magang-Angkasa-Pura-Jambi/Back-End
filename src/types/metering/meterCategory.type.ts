import { z } from 'zod';

import type { meterCategorySchema } from '../../validations/metering/meterCategory.validation.js';

export type CreateMeterCategoryBody = z.infer<
  typeof meterCategorySchema.create
>;

export type UpdateMeterCategoryBody = z.infer<
  typeof meterCategorySchema.update
>;

export type MeterCategoryParams = z.infer<typeof meterCategorySchema.params>;

export type GetMeterCategoryQuery = z.infer<
  typeof meterCategorySchema.listQuery
>;
