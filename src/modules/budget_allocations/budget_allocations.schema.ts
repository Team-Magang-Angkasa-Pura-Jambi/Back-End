import { z } from 'zod';

const distributionTransform = (data: any) => {
  if (!data.monthly_distribution_profile && data.allocated_amount) {
    const val = Number((data.allocated_amount / 12).toFixed(2));
    const months = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    data.monthly_distribution_profile = months.reduce((acc, m) => ({ ...acc, [m]: val }), {});
  }
  return data;
};

const allocationShape = {
  budget_id: z.number().int().positive(),
  meter_id: z.number().int().positive(),
  allocated_amount: z.coerce.number().min(0),
  allocated_volume: z.coerce.number().min(0),
  monthly_distribution_profile: z.record(z.string(), z.number()).optional(),
};

export const allocationSchema = {
  store: z.object({
    body: z.object({
      allocation: z.object(allocationShape).transform(distributionTransform),
    }),
  }),

  show: z.object({
    params: z.object({
      id: z.coerce.number().int().optional(),
    }),
    query: z.object({
      budget_id: z.coerce.number().int().optional(),
      meter_id: z.coerce.number().int().optional(),
    }),
  }),

  patch: z.object({
    params: z.object({
      id: z.coerce.number().int(),
    }),
    body: z.object({
      allocation: z.object(allocationShape).partial().transform(distributionTransform),
    }),
  }),

  remove: z.object({
    params: z.object({
      id: z.coerce.number().int(),
    }),
  }),
};
