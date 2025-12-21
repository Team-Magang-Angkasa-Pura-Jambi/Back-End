import z from 'zod';
import { positiveInt, requiredString } from '../../utils/schmeHelper.js';
import { CrudSchemaBuilder } from '../../utils/shemaHandler.js';

const meterCategoryParamsSchema = z.object({
  categoryId: positiveInt('category ID'),
});

const meterCategoryBody = z.object({
  name: requiredString('name'),
});

export const meterCategorySchema = new CrudSchemaBuilder({
  bodySchema: meterCategoryBody,
  paramsSchema: meterCategoryParamsSchema,
});

export const queryMeterCatagory = meterCategorySchema.getList(z.object({}));
