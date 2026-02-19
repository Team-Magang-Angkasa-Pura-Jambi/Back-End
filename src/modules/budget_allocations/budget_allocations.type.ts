import { type Prisma } from '../../generated/prisma/index.js';

export interface CreateAllocationPayload {
  allocation: Prisma.BudgetAllocationUncheckedCreateInput;
}

export interface UpdateAllocationPayload {
  allocation: Prisma.BudgetAllocationUncheckedUpdateInput;
}
