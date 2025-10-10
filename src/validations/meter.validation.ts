import { MeterStatus } from '../generated/prisma/index.js';
import { optionalString, positiveInt, requiredString } from './schmeHelper.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';
import z from 'zod';

const meterParamsSchema = z.object({
  meterId: positiveInt('Meter ID'),
});

const meterBodySchema = z.object({
  meter_code: requiredString('Meter Code'),
  energy_type_id: positiveInt('Energy Type Id'),
  category_id: positiveInt('category Id'),
  status: z.enum(MeterStatus).default(MeterStatus.Active),
  tariff_group_id: positiveInt('tariff group Id'),
});

export const meterSchema = new CrudSchemaBuilder({
  bodySchema: meterBodySchema,
  paramsSchema: meterParamsSchema,
});

export const queryMeter = meterSchema.getList(
  z.object({
    energyTypeId: positiveInt('energy type id').optional(),
    typeName: optionalString('type name'),
  })
);
