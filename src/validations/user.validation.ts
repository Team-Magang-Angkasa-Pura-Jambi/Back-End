import { z } from 'zod';

const numericString = z.string().regex(/^\d+$/, 'Harus berupa angka').trim();

export const getUsersSchema = z.object({
  query: z.object({
    search: z.string().optional(),

    role_id: numericString.transform(Number).optional(),

    page: numericString.default('1').transform(Number),

    limit: numericString.default('10').transform(Number),
  }),
});

export type GetUsersQuery = z.infer<typeof getUsersSchema>['query'];
