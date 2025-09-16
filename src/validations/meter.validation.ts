import { number, z } from 'zod';
import { MeterStatus } from '../generated/prisma/index.js';

/**
 * Skema validasi untuk parameter ID di URL.
 */
export const idParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID harus berupa angka positif.'),
});

/**
 * Skema validasi untuk body request saat membuat meteran baru.
 */
export const createMeterSchema = z.object({
  body: z.object({
    meter_code: z.string().min(1, { message: 'meter_code wajib diisi.' }),

    // Gunakan z.coerce.number() agar bisa menerima string angka dan mengubahnya menjadi number
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
  body: z
    .object({
      meter_code: z.string().min(1),
      location: z.string(),
      status: z.nativeEnum(MeterStatus),
      energy_type_id: z.number(),
    })
    .partial(), // .partial() membuat semua field di dalamnya menjadi opsional
});
