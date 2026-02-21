import { z } from 'zod';
import { MeterStatus, TankShape } from '../../generated/prisma/index.js';

const meterBase = {
  meter_code: z.string({ error: () => ({ message: 'Kode Meter wajib diisi' }) }).min(3),
  serial_number: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  tenant_id: z.number().optional().nullable(),
  location_id: z.number().optional().nullable(),
  calculation_template_id: z.string().uuid().optional().nullable(),
  price_scheme_id: z.number().optional().nullable(),
  energy_type_id: z.number({ error: () => ({ message: 'Tipe Energi wajib diisi' }) }),

  multiplier: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number()),

  is_virtual: z.boolean(),
  allow_gap: z.boolean(),
  allow_decrease: z.boolean(),
  rollover_limit: z.coerce.number().optional().nullable(),

  status: z.nativeEnum(MeterStatus, {
    error: () => ({ message: 'Status harus ACTIVE, INACTIVE, atau MAINTENANCE' }),
  }),
};

const profileBase = {
  shape: z.nativeEnum(TankShape).optional().nullable(),
  height_max_cm: z.coerce.number().min(0),
  length_cm: z.coerce.number().min(0).optional().nullable(),
  width_cm: z.coerce.number().min(0).optional().nullable(),
  diameter_cm: z.coerce.number().min(0).optional().nullable(),
  capacity_liters: z.coerce.number().min(0),
};

const configBase = {
  reading_type_id: z.coerce.number({ error: 'ID Reading Type wajib diisi' }),
  is_active: z.boolean().default(true),
  alarm_min_threshold: z.coerce.number().optional().nullable(),
  alarm_max_threshold: z.coerce.number().optional().nullable(),
};

export const meterSchema = {
  store: z.object({
    body: z.object({
      meter: z.object(meterBase).extend({
        multiplier: meterBase.multiplier.default(1.0),
        is_virtual: meterBase.is_virtual.default(false),
        allow_gap: meterBase.allow_gap.default(false),
        allow_decrease: meterBase.allow_decrease.default(false),
        status: meterBase.status.default(MeterStatus.ACTIVE),
      }),
      meter_profile: z.object(profileBase).optional(),
      reading_config: z.array(z.object(configBase).optional()),
    }),
  }),

  /**
   * PATCH: Semua field opsional, tidak ada default value yang menimpa data lama
   */
  patch: z.object({
    params: z.object({
      id: z.coerce.number({ error: () => ({ message: 'ID Meter wajib diisi' }) }),
    }),
    body: z.object({
      meter: z.object(meterBase).partial().optional(),
      meter_profile: z.object(profileBase).partial().optional(),
      reading_config: z.array(z.object(configBase).optional()),
    }),
  }),

  /**
   * SHOW: Untuk List & Pagination
   */
  show: z.object({
    params: z.object({
      id: z.coerce.number().optional(),
    }),
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      search: z.string().optional(),
      energy_type_id: z.coerce.number().optional(),
      location_id: z.coerce.number().optional(),
      tenant_id: z.coerce.number().optional(),
      is_virtual: z.preprocess((val) => val === 'true', z.boolean()).optional(),
      status: z.nativeEnum(MeterStatus).optional(),
    }),
  }),

  remove: z.object({
    params: z.object({
      id: z.coerce.number({ error: () => ({ message: 'ID Meter wajib diisi' }) }),
    }),
  }),
};
