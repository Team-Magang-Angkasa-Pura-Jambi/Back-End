import { type Prisma } from '../../generated/prisma/index.js';

export interface CreatePriceSchemePayload {
  scheme: Prisma.PriceSchemeCreateInput;
}

export interface UpdatePriceSchemePayload {
  scheme: Prisma.PriceSchemeUpdateInput;
}

export interface PriceSchemeQuery {
  page?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
}
