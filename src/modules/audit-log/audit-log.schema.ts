import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  query: z.object({
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

    // Gunakan transform untuk memastikan string tanggal bersih
    start_date: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Format start_date tidak valid',
      }),
    end_date: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Format end_date tidak valid',
      }),
  }),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
