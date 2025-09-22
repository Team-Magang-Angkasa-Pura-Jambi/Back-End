import { z, type ZodObject, type ZodRawShape } from 'zod';
import type {
  CrudSchemaConfig,
  CrudSchemas,
  GetListSchema,
  ExtendWithCustom,
} from './types.js';

export class CrudSchemaBuilder<
  TBodySchema extends ZodObject<any>,
  TParamsSchema extends ZodObject<any>,
> implements CrudSchemas<TBodySchema, TParamsSchema>
{
  body: TBodySchema;
  bodyPartial: ReturnType<TBodySchema['partial']>;
  params: TParamsSchema;
  listQuery: ZodObject<any>;

  create: CrudSchemas<TBodySchema, TParamsSchema>['create'];
  update: CrudSchemas<TBodySchema, TParamsSchema>['update'];
  byId: CrudSchemas<TBodySchema, TParamsSchema>['byId'];

  constructor(config: CrudSchemaConfig<TBodySchema, TParamsSchema>) {
    const { bodySchema, paramsSchema } = config;

    this.body = bodySchema;
    this.bodyPartial = bodySchema.partial() as ReturnType<
      TBodySchema['partial']
    >;
    this.params = paramsSchema;

    this.listQuery = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().default(10),
      search: z.string().optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
    });

    this.create = z.object({ body: bodySchema });
    this.update = z.object({ body: this.bodyPartial, params: paramsSchema });
    this.byId = z.object({ params: paramsSchema });
  }

  getList<TCustomFilters extends ZodObject<ZodRawShape> | undefined>(
    customFilters?: TCustomFilters
  ): z.ZodObject<GetListSchema<TCustomFilters>> {
    const baseQuerySchema = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().default(10),
      search: z.string().optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    });

    const finalQuerySchema = customFilters
      ? baseQuerySchema.merge(customFilters)
      : baseQuerySchema;

    return z.object({ query: finalQuerySchema }) as any;
  }

  addCustomSchema<K extends string, V>(
    name: K,
    schema: V
  ): ExtendWithCustom<this, K, V> {
    return Object.assign(this, { [name]: schema }) as ExtendWithCustom<
      this,
      K,
      V
    >;
  }
}
