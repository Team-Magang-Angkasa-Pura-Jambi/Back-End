import { z } from 'zod';

export const readingSchema = {
  store: z.object({
    body: z.object({
      reading: z.object({
        meter_id: z.number().int().positive(),
        reading_date: z.coerce.date(),
        evidence_image_url: z.string().url().optional().nullable(),
        notes: z.string().optional().nullable(),
        details: z
          .array(
            z.object({
              reading_type_id: z.number().int().positive(),
              value: z.coerce.number().min(0),
            }),
          )
          .min(1, 'Minimal satu detail pembacaan wajib diisi'),
      }),
    }),
  }),

  show: z.object({
    query: z.object({
      meter_id: z.coerce.number().optional(),
      from_date: z
        .string()
        .optional()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
          message: 'Format tanggal from_date tidak valid (Gunakan YYYY-MM-DD)',
        })
        .transform((val) => (val ? new Date(val) : undefined)),

      to_date: z
        .string()
        .optional()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
          message: 'Format tanggal to_date tidak valid (Gunakan YYYY-MM-DD)',
        })
        .transform((val) => (val ? new Date(val) : undefined)),
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
    }),
  }),

  remove: z.object({
    params: z.object({
      id: z.coerce.number().int(),
    }),
  }),
};
