// src/types/generic.type.ts

import { z, ZodObject } from 'zod';

/**
 * Sebuah tipe generik yang berfungsi sebagai "pabrik".
 * Tipe ini menerima tiga skema Zod (create, update, params)
 * dan secara otomatis menghasilkan tiga tipe input yang sesuai.
 */
export type CrudTypes<
  TCreateSchema extends ZodObject<any>,
  TUpdateSchema extends ZodObject<any>,
  TParamsSchema extends ZodObject<any>,
> = {
  CreateInput: z.infer<TCreateSchema>['body'];
  UpdateInput: z.infer<TUpdateSchema>['body'];
  Params: z.infer<TParamsSchema>['params'];
};
