import { z, ZodObject } from 'zod';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';
import {
  optionalString,
  positiveInt,
  requiredString,
} from '../utils/schmeHelper.js';

const tariffGroupBodySchema = z.object({
  group_code: requiredString('Group Code'),
  group_name: requiredString('Group Name'),
  daya_va: positiveInt('Daya VA'),
  description: optionalString('Description'),
});

const tariffGroupParamsSchema = z.object({
  tariffGroupId: positiveInt('Tariff Group ID'),
});

export const tariffGroupSchemas = new CrudSchemaBuilder({
  bodySchema: tariffGroupBodySchema,
  paramsSchema: tariffGroupParamsSchema,
});

export const paramsTariffGroup = tariffGroupSchemas.getList(
  z.object({
    typeId: positiveInt('Type ID'),
  })
);
