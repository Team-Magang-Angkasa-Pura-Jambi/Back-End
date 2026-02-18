import z from 'zod';
import { RoleType } from '../../generated/prisma/index.js';

export const RolesSchema = {
  store: z.object({
    body: z
      .object({
        role_name: z.nativeEnum(RoleType, {
          error: () => ({ message: 'Role harus berupa ADMIN, SUPER_ADMIN, atau USER' }),
        }),
      })
      .strict(),
  }),

  show: z.object({
    params: z.object({
      id: z.coerce.number().optional(),
    }),
    query: z.object({
      role_name: z.string().optional(),
    }),
  }),
};

export type RolesSchemaPayload = z.infer<typeof RolesSchema.store>['body'];
export type RolesSchemaQuery = z.infer<typeof RolesSchema.show>['query'];
export type RolesSchemaParams = z.infer<typeof RolesSchema.show>['params'];
