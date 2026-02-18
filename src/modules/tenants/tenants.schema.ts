// Generated for Sentinel Project

import z from 'zod';
import { phoneSchema } from '../../utils/phoneSchema.js';

export const tenantsSchema = {
  store: z.object({
    body: z.object({
      name: z.string().min(1),
      category: z.string().min(1).optional(),
      contact_person: z.string().min(1).optional(),
      phone: phoneSchema.optional(),
      email: z.string().email('Format email tidak valid. Contoh: nama@email.com').optional(),
    }),
  }),
  show: z.object({
    query: z.object({
      name: z.string().optional(),
      category: z.string().optional(),
      contact_person: z.string().optional(),
    }),
    params: z.object({
      id: z.coerce.number().optional(),
    }),
  }),
  patch: z.object({
    params: z.object({
      id: z.coerce.number().optional(),
    }),
    body: z.object({
      name: z.string().min(1).optional(),
      category: z.string().min(1).optional(),
      contact_perseon: z.string().min(1).optional(),
      phone: z.string().min(1).optional(),
      email: z.string().min(1).optional(),
    }),
  }),
  remove: z.object({
    params: z.object({
      id: z.coerce.number().optional(),
    }),
  }),
};
