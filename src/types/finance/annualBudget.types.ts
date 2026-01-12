import type z from 'zod';
import type { Prisma } from '../../generated/prisma/index.js';
import { type getAnnualBudgetSchema } from '../../validations/finance/annualBudget.validation.js';

export interface AllocationData {
  meter_id: number;
  weight: number;
}

export type CreateAnnualBudgetBody = Omit<
  Prisma.AnnualBudgetCreateInput,
  'energy_type' | 'allocations'
> & {
  allocations: AllocationData[];
  energy_type_id: number;
  parent_budget_id?: number;
};

export type UpdateAnnualBudgetBody = Partial<CreateAnnualBudgetBody>;

export type GetAnnualBudgetQuery = z.infer<typeof getAnnualBudgetSchema>['query'];
