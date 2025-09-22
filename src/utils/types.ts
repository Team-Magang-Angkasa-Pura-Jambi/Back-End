import type { z, ZodObject, ZodRawShape } from 'zod';

/**
 * Konfigurasi awal untuk membuat CRUD Schema Builder
 */
export interface CrudSchemaConfig<
  TBodySchema extends ZodObject<any>,
  TParamsSchema extends ZodObject<any>,
> {
  /** Skema validasi untuk body request */
  bodySchema: TBodySchema;
  /** Skema validasi untuk parameter URL */
  paramsSchema: TParamsSchema;
}

/**
 * Bentuk dasar schema CRUD yang dihasilkan
 */
export interface CrudSchemas<
  TBodySchema extends ZodObject<any>,
  TParamsSchema extends ZodObject<any>,
> {
  body: TBodySchema;
  bodyPartial: ReturnType<TBodySchema['partial']>;
  params: TParamsSchema;
  listQuery: ZodObject<any>;

  create: ZodObject<{
    body: TBodySchema;
  }>;

  update: ZodObject<{
    body: ReturnType<TBodySchema['partial']>;
    params: TParamsSchema;
  }>;

  byId: ZodObject<{
    params: TParamsSchema;
  }>;
}

/**
 * Tipe untuk method getList
 */
export type GetListSchema<
  TCustomFilters extends ZodObject<ZodRawShape> | undefined,
> = {
  query: TCustomFilters extends ZodObject<ZodRawShape>
    ? ZodObject<TCustomFilters['shape'] & { [k: string]: any }>
    : ZodObject<any>;
};
/**
 * Utility type untuk schema tambahan yang bisa ditambahkan via addCustomSchema
 */
export type ExtendWithCustom<T, K extends string, V> = T & { [P in K]: V };
