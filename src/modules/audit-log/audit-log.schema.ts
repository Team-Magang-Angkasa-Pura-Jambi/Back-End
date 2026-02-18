// Generated for Sentinel Project

import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => Number(val) || 1),
  limit: z
    .string()
    .optional()
    .transform((val) => Number(val) || 10),
  action: z.string().optional(),
  entity_table: z.string().optional(),
  user_id: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : undefined)),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
