import { number, z } from 'zod';
import { MeterStatus } from '../generated/prisma/index.js';

/**
 * Skema validasi untuk parameter ID di URL.
 */
export const idParamsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID harus berupa angka positif.'),
  }),
});

export const createMeterSchema = z.object({
  body: z.object({
    meter_code: z.string().min(1, { message: 'meter_code wajib diisi.' }),

    energy_type_id: z.coerce.number({
      error: 'energy_type_id harus berupa angka.',
    }),

    location: z.string().optional(),

    status: z.nativeEnum(MeterStatus).optional(),
  }),
});

/**
 * Skema validasi untuk body request saat memperbarui meteran.
 */
export const updateMeterSchema = z.object({
  params: z.object({
    id: z.coerce
      .number()
      .positive('ID parameter harus merupakan angka positif.'),
  }),

  body: z
    .object({
      meter_code: z
        .string()
        .nonempty('Jika diisi, meter_code tidak boleh kosong.'),
      location: z.string().nonempty('Jika diisi, lokasi tidak boleh kosong.'),
      status: z.nativeEnum(MeterStatus),

      energy_type_id: z.coerce
        .number()
        .positive('ID Tipe Energi harus angka positif.'),
    })
    .partial()

    .refine((data) => Object.keys(data).length > 0, {
      message: 'Body request untuk update tidak boleh kosong.',
    }),
});
