import { type Prisma } from '../../generated/prisma/index.js';

// 1. Buat tipe dasar untuk alokasi yang dikirim dari Frontend
export interface AllocationPayload {
  meter_id: number;
  allocated_amount: number | Prisma.Decimal;
  allocated_volume: number | Prisma.Decimal;
  monthly_distribution_profile?: Record<string, number> | Prisma.InputJsonValue | null;
}

// 2. Payload Create: Menggunakan field bawaan Prisma, tapi override bagian allocations
export interface CreateBudgetPayload extends Omit<
  Prisma.AnnualBudgetUncheckedCreateInput,
  'allocations'
> {
  allocations?: AllocationPayload[];
}

// 3. Payload Update: Menggunakan field bawaan Prisma, tapi override bagian allocations
export interface UpdateBudgetPayload extends Omit<
  Prisma.AnnualBudgetUncheckedUpdateInput,
  'allocations'
> {
  allocations?: AllocationPayload[];
}
