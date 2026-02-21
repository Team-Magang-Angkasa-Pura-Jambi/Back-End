import { z } from 'zod';
import { Parser } from 'expr-eval';

const parser = new Parser();

// 1. VARIABLE SCHEMA (Strict Union)
// PERBAIKAN: Gunakan 'type' (bukan 'source') dan 'reading'/'spec' agar sinkron dengan formulaEngine.ts
const variableSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('reading'),
    label: z.string().min(1, 'Label wajib'),
    readingTypeId: z.number().int(),
    timeShift: z.number().int().default(0),
    meterId: z.number().int().optional(),
  }),
  z.object({
    type: z.literal('spec'),
    label: z.string().min(1),
    specField: z.string().min(1),
    meterId: z.number().int().optional(),
  }),
  z.object({
    type: z.literal('constant'),
    label: z.string().min(1),
    value: z.coerce.number(),
  }),
]);

// 2. FORMULA ITEM SCHEMA (With Logic Sync)
const formulaItemSchema = z
  .object({
    formula: z.string().min(1, 'Rumus wajib diisi'),
    variables: z.array(variableSchema).min(1),
  })
  .superRefine((data, ctx) => {
    try {
      const varsInFormula = parser.parse(data.formula).variables();
      const definedLabels = data.variables.map((v) => v.label);

      varsInFormula.forEach((v) => {
        if (!definedLabels.includes(v)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Variabel "${v}" di rumus belum didaftarkan.`,
            path: ['formula'],
          });
        }
      });
    } catch (e) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rumus error', path: ['formula'] });
    }
  });

// 3. MAIN SHAPES
const formulaDefinitionShape = z.object({
  name: z.string().min(1),
  is_main: z.boolean().default(false),
  formula_items: formulaItemSchema,
});

const templateShape = {
  name: z.string().min(1),
  description: z.string().optional().nullable(),
};

// 4. THE COMPLETE EXPORT
export const templateSchema = {
  store: z.object({
    body: z.object({
      template: z.object({
        ...templateShape,
        definitions: z.array(formulaDefinitionShape).min(1),
      }),
    }),
  }),

  show: z.object({
    params: z.object({
      id: z.string().uuid('ID tidak valid').optional(),
    }),
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      search: z.string().optional(),
    }),
  }),

  patch: z.object({
    params: z.object({
      id: z.string().uuid('ID tidak valid'),
    }),
    body: z.object({
      template: z
        .object({
          ...templateShape,
          definitions: z.array(formulaDefinitionShape.partial()).optional(),
        })
        .partial(),
    }),
  }),

  remove: z.object({
    params: z.object({
      id: z.string().uuid('ID tidak valid'),
    }),
  }),
};
