// Generated for Sentinel Project
import z from 'zod';
import { RoleType } from '../../generated/prisma/index.js';

export const RolesSchema = {
  body: z.object({
    id: z.coerce.number().optional(),
    body: z
      .object({
        role_name: z.enum(RoleType), // Validasi panjang
      })
      .strict(),
  }),
  query: z.object({ user_name: z.string().optional() }),
};

export type RolesSchemaPayload = z.infer<typeof RolesSchema.body>;
