import { z } from 'zod';

export const bugReportSchema = {
  store: z.object({
    body: z.object({
      title: z.string().min(3, 'Judul laporan minimal 3 karakter').max(200),
      description: z.string().min(5, 'Deskripsi laporan minimal 5 karakter'),
      category: z
        .enum([
          'UI_BUG',
          'CALCULATION_ERROR',
          'API_FAILURE',
          'DATA_MISMATCH',
          'PERFORMANCE',
          'FEATURE_REQUEST',
          'OTHER',
        ])
        .default('UI_BUG'),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
      page_url: z.string().optional().nullable(),
      browser_info: z.any().optional().nullable(),
      error_stack: z.string().optional().nullable(),
      screenshot_url: z.string().optional().nullable(),
    }),
  }),

  show: z.object({
    params: z.object({
      id: z.string().uuid('ID tidak valid').optional(),
    }),
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(15),
      search: z.string().optional(),
      status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'ALL']).optional(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'ALL']).optional(),
      category: z.string().optional(),
    }),
  }),

  updateStatus: z.object({
    params: z.object({
      id: z.string().uuid('ID tidak valid'),
    }),
    body: z.object({
      status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']),
      developer_response: z.string().optional().nullable(),
    }),
  }),

  remove: z.object({
    params: z.object({
      id: z.string().uuid('ID tidak valid'),
    }),
  }),
};
