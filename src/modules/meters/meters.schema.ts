import { z } from 'zod';
import { MeterStatus, TankShape } from '../../generated/prisma/index.js';

const meterShape = {
  meter_code: z.string({ error: 'Kode Meter wajib diisi' }).min(3),
  serial_number: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  tenant_id: z.number().optional().nullable(),
  location_id: z.number().optional().nullable(),
  calculation_template_id: z.string().uuid().optional().nullable(),
  price_scheme_id: z.number().optional().nullable(),
  energy_type_id: z.number({ error: 'Tipe Energi wajib diisi' }),
  multiplier: z.coerce.number().default(1.0),
  initial_reading: z.coerce.number().default(0),
  status: z
    .nativeEnum(MeterStatus, {
      error: () => ({ message: 'Status harus ACTIVE, INACTIVE, atau MAINTENANCE' }),
    })
    .default(MeterStatus.ACTIVE),
};

const profileShape = {
  shape: z
    .nativeEnum(TankShape, {
      error: () => ({
        message:
          'Bentuk tangki tidak valid. Pilihan yang tersedia: CYLINDER_VERTICAL, CYLINDER_HORIZONTAL, atau BOX',
      }),
    })
    .optional(),
  height_max_cm: z.coerce.number().min(0),
  length_cm: z.coerce.number().min(0).optional().nullable(),
  width_cm: z.coerce.number().min(0).optional().nullable(),
  diameter_cm: z.coerce.number().min(0).optional().nullable(),
  capacity_liters: z.coerce.number().min(0),
};

export const meterSchema = {
  store: z.object({
    body: z.object({
      meter: z.object(meterShape),
      meter_profile: z.object(profileShape).optional(),
    }),
  }),

  show: z.object({
    params: z.object({
      id: z.coerce.number().optional(),
    }),
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      search: z.string().optional(),
      energy_type: z.string().optional(),
      location_id: z.coerce.number().optional(),
      tenant_id: z.coerce.number().optional(),
      status: z
        .nativeEnum(MeterStatus, {
          error: () => ({ message: 'Status harus ACTIVE, INACTIVE, atau MAINTENANCE' }),
        })
        .optional(),
    }),
  }),

  patch: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID Meter wajib diisi' }),
    }),
    body: z.object({
      meter: z.object(meterShape).partial(),
      meter_profile: z.object(profileShape).partial(),
    }),
  }),

  remove: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID Meter wajib diisi' }),
    }),
  }),
};
