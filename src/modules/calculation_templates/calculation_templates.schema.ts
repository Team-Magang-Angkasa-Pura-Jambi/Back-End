import { z } from 'zod';

const formulaItemSchema = z.array(
  z.object({
    type: z.enum(['field', 'operator', 'constant', 'variable']),
    value: z.string().min(1),
  }),
);

const templateShape = {
  name: z.string().min(1, 'Nama template wajib diisi'),
  description: z.string().optional().nullable(),
};

const formulaShape = {
  name: z.string().min(1, 'Nama formula wajib diisi (contoh: LWBP)'),
  is_main: z.boolean().default(false),
  formula_items: formulaItemSchema,
};

export const templateSchema = {
  store: z.object({
    body: z.object({
      template: z.object({
        ...templateShape,
        definitions: z.object({
          create: z.array(z.object(formulaShape)).min(1, 'Minimal harus ada satu formula'),
        }),
      }),
    }),
  }),

  show: z.object({
    params: z.object({
      id: z.string().uuid('ID Template tidak valid').optional(),
    }),
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      search: z.string().optional(),
    }),
  }),

  patch: z.object({
    params: z.object({
      id: z.string().uuid('ID Template tidak valid'),
    }),
    body: z.object({
      template: z.object(templateShape).partial(),
    }),
  }),

  remove: z.object({
    params: z.object({
      id: z.string().uuid('ID Template tidak valid'),
    }),
  }),
};
