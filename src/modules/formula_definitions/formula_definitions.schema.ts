import { z } from 'zod';

const formulaItemSchema = z.object({
  type: z.enum(['field', 'operator', 'constant', 'variable']),
  value: z.string().min(1, 'Value item formula tidak boleh kosong'),
});

const formulaShape = {
  template_id: z.string().uuid('ID Template harus format UUID'),
  name: z.string().min(1, 'Nama formula wajib diisi'),
  is_main: z.boolean().default(false),
  formula_items: z.array(formulaItemSchema).min(1, 'Minimal harus ada satu item formula'),
};

export const formulaSchema = {
  show: z.object({
    params: z.object({
      id: z.string().uuid().optional(),
    }),
    query: z.object({
      template_id: z.string().uuid().optional(),
    }),
  }),

  store: z.object({
    body: z.object({
      formula: z.object({
        template_id: z.string().uuid(),
        name: z.string().min(1),
        is_main: z.boolean().default(false),
        formula_items: z.array(z.any()).min(1),
      }),
    }),
  }),
  patch: z.object({
    params: z.object({
      id: z.string().uuid('ID Formula tidak valid'),
    }),
    body: z.object({
      formula: z.object(formulaShape).omit({ template_id: true }).partial(),
    }),
  }),

  remove: z.object({
    params: z.object({
      id: z.string().uuid('ID Formula tidak valid'),
    }),
  }),
};
