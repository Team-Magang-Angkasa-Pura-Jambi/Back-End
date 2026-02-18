import z from 'zod';

export const energiesSchema = {
  show: z.object({
    query: z.object({
      name: z.string().optional(),
    }),
    params: z.object({
      id: z.coerce.number().optional(),
    }),
  }),

  store: z.object({
    body: z.object({
      name: z.string({ error: 'Nama energi wajib diisi' }).min(1),
      unit_standard: z.string({ error: 'Satuan standar wajib diisi' }).min(1),
    }),
  }),

  patch: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID Energi harus diisi' }),
    }),
    body: z.object({
      name: z.string().min(1).optional(),
    }),
  }),

  remove: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID Energi harus diisi' }),
    }),
  }),
};

export type EnergyBodyPayload = z.infer<typeof energiesSchema.store>['body'];
