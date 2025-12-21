import { z } from 'zod';
import {
  optionalString,
  positiveInt,
  requiredString,
} from '../../utils/schmeHelper.js';
import { CrudSchemaBuilder } from '../../utils/shemaHandler.js';

export const EnergyTypeBodySchema = z.object({
  type_name: requiredString('Energi Type'),
  unit_of_measurement: requiredString('unit'),
});

const userParamsSchema = z
  .object({
    energyTypeId: positiveInt('User ID'),
  })
  .strict();

export const energyTypeSchema = new CrudSchemaBuilder({
  bodySchema: EnergyTypeBodySchema,
  paramsSchema: userParamsSchema,
});

export const queryEnergy = z.object({
  query: z.object({
    typeName: optionalString('type name'),
  }),
});
