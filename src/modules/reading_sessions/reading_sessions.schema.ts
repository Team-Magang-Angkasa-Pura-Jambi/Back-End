import { z } from 'zod';

const readingBodySchema = z.object({
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
});

export const readingSchema = {
  store: z.object({
    body: readingBodySchema,
  }),

  update: z.object({
    params: z.object({
      id: z.coerce.number().int(),
    }),
    body: readingBodySchema.partial(),
  }),

  recalculate: z.object({
    body: z.object({
      meter_id: z.number().int().positive(),
      start_date: z.coerce.date(),
      to_date: z.coerce.date(),
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

  lastReading: z.object({
    query: z.object({
      meter_id: z.coerce.number().optional(),
      meterId: z.coerce.number().optional(),
      reading_type_id: z.coerce.number().optional(),
      readingTypeId: z.coerce.number().optional(),
      reading_date: z.string().optional(),
      readingDate: z.string().optional(),
    }),
  }),
};
