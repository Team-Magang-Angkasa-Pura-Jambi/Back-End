import { type Prisma } from '../../generated/prisma/index.js';

export interface CreateBudgetPayload {
  budget: Prisma.AnnualBudgetUncheckedCreateInput & {
    allocations?: {
      create: Prisma.BudgetAllocationUncheckedCreateWithoutBudgetInput[];
    };
  };
}

export interface UpdateBudgetPayload {
  budget: Prisma.AnnualBudgetUncheckedUpdateInput & {
    allocations?: {
      deleteMany?: Record<string, any>;
      upsert?: {
        where: { allocation_id: number };
        update: Prisma.BudgetAllocationUncheckedUpdateWithoutBudgetInput;
        create: Prisma.BudgetAllocationUncheckedCreateWithoutBudgetInput;
      }[];
    };
  };
}
