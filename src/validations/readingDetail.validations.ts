import { z } from 'zod';

export const createReadingDetailSchema = z.object({
  body: z.object({
    value: z.number({
      error: 'Nilai harus berupa angka',
    }),

    session_id: z
      .number({
        error: 'ID Sesi wajib diisi',
      })
      .int()
      .positive('ID Sesi harus bilangan bulat positif'),

    reading_type_id: z
      .number({
        error: 'ID Tipe Pembacaan wajib diisi',
      })
      .int()
      .positive('ID Tipe Pembacaan harus bilangan bulat positif'),
  }),
});

export const updateReadingDetailSchema = z.object({
  body: z.object({
    value: z
      .number({
        error: 'Nilai harus berupa angka',
      })
      .optional(),

    session_id: z
      .number({
        error: 'ID Sesi wajib diisi',
      })
      .int()
      .positive('ID Sesi harus bilangan bulat positif')
      .optional(),

    reading_type_id: z
      .number({
        error: 'ID Tipe Pembacaan wajib diisi',
      })
      .int()
      .positive('ID Tipe Pembacaan harus bilangan bulat positif')
      .optional(),
  }),
});

export const readingDetailParamsSchema = z.object({
  params: z.object({
    detail_id: z.string().refine((val) => !isNaN(parseInt(val, 10)), {
      message: 'User ID harus berupa angka.',
    }),
  }),
});
