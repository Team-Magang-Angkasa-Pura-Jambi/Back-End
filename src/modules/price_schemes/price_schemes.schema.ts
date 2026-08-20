import { z } from 'zod';

const rateShape = z.object({
  rate_id: z.number().int().optional(), // Tambahkan ini agar bisa pilih mana yang diupdate
  reading_type_id: z.number().int().positive(),
  rate_value: z.coerce.number().positive(),
});

const schemeShape = {
  name: z.string().min(1, 'Nama skema harga wajib diisi'),
  description: z.string().optional().nullable(),
  effective_date: z.coerce.date({
    error: 'Tanggal efektif wajib diisi',
  }),
  is_active: z.boolean().default(true),
};

export const priceSchemeSchema = {
  store: z.object({
    body: z.object({
      scheme: z.object({
        ...schemeShape,
        rates: z.object({
          create: z.array(rateShape).min(1, 'Minimal harus ada satu tarif (rate)'),
        }),
      }),
    }),
  }),

  show: z.object({
    params: z.object({
      id: z.coerce.number().int().optional(),
    }),
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      search: z.string().optional(),
      is_active: z
        .enum(['true', 'false'])
        .optional()
        .transform((val) => (val === undefined ? undefined : val === 'true')),
    }),
  }),

  patch: z.object({
    params: z.object({
      id: z.coerce.number().int(),
    }),
    body: z.object({
      scheme: z
        .object({
          ...schemeShape,

          rates: z
            .object({
              create: z
                .array(rateShape)
                .min(1, 'Minimal harus ada satu tarif jika ingin update rates'),
            })
            .optional(),
        })
        .partial(),
    }),
  }),

  remove: z.object({
    params: z.object({
      id: z.coerce.number().int(),
    }),
  }),
};
