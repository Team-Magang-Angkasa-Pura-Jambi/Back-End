import z from 'zod';

export const PaginationRules = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const DateRangeRules = z.object({
  startDate: z
    .string()
    .datetime({ message: 'Start date must be a valid ISO string' })
    .optional(),
  endDate: z
    .string()
    .datetime({ message: 'End date must be a valid ISO string' })
    .optional(),
});
