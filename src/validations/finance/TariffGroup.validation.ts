import { z } from 'zod';
import { CrudSchemaBuilder } from '../../utils/shemaHandler.js';
import { optionalString, positiveInt, requiredString } from '../../utils/schmeHelper.js';

const tariffGroupBodySchema = z.object({
  group_code: requiredString('Group Code'),
  group_name: requiredString('Group Name'),
  daya_va: z.coerce
    .number({ error: `Daya VA wajib diisi.` })
    .int({ message: ` Daya VA harus berupa bilangan bulat.` })
    .optional(),
  description: optionalString('Description'),
  faktor_kali: positiveInt('faktor kali'),
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
  }),
);
