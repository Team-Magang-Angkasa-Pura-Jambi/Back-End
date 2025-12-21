import { z } from 'zod';
import { positiveInt, positiveNumber } from '../utils/schmeHelper.js';
import { CrudSchemaBuilder } from '../utils/shemaHandler.js';

export const annualBudgetParamsSchema = z.object({
  budgetId: positiveInt('Budget ID'),
});

const annualBudgetBodySchema = z
  .object({
    period_start: z.coerce.date({
      message: 'Tanggal mulai periode tidak valid.',
    }),
    period_end: z.coerce.date({
      message: 'Tanggal akhir periode tidak valid.',
    }),
    total_budget: positiveNumber('Total Budget'),
    efficiency_tag: z.coerce.number().min(0).max(1).nullable().optional(),

    energy_type_id: positiveInt('Energy Type ID'),

    parent_budget_id: positiveInt('Parent Budget ID').optional().nullable(),

    allocations: z.array(
      z.object({
        meter_id: positiveInt('Meter ID dalam alokasi'),
        weight: positiveNumber('Bobot alokasi').min(0).max(1),
      }),
      { message: 'Alokasi harus berupa array.' }
    ),
  })
  .refine((data) => data.period_end > data.period_start, {
    message: 'Tanggal akhir periode harus setelah tanggal mulai.',
    path: ['period_end'],
  })
  .refine(
    (data) => {
      if (data.parent_budget_id) {
        if (data.allocations.length === 0) {
          return false;
        }
        const totalWeight = data.allocations.reduce(
          (sum, alloc) => sum + alloc.weight,
          0
        );

        return Math.abs(totalWeight - 1) < 0.001;
      }

      return true;
    },
    {
      message:
        'Untuk anggaran periode (anak), minimal harus ada satu alokasi dan total bobotnya harus 100%.',
      path: ['allocations'],
    }
  );

export const annualBudgetSchema = new CrudSchemaBuilder({
  bodySchema: annualBudgetBodySchema,
  paramsSchema: annualBudgetParamsSchema,
});

export const queryAnnualBudget = z.object({
  query: z.object({
    date: z.string().date('Format tanggal tidak valid.').optional(),
  }),
});
