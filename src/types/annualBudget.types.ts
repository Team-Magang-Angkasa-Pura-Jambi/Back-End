import type { Prisma } from '../generated/prisma/index.js';

export type AllocationData = {
  meter_id: number;
  weight: number;
};


export type CreateAnnualBudgetBody = Omit<
  Prisma.AnnualBudgetCreateInput,
  'energy_type' | 'allocations'
> & {
  allocations: AllocationData[];
  energy_type_id: number;
};


export type UpdateAnnualBudgetBody = Partial<CreateAnnualBudgetBody>;


export type GetAnnualBudgetQuery = {
  date?: string; // Format YYYY-MM-DD
};
