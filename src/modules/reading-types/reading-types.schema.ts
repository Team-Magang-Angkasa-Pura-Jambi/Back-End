import z from 'zod';

export const readingTypesSchema = {
  show: z.object({
    query: z.object({
      type_name: z.string().optional(),
    }),
    params: z.object({
      id: z.coerce.number().optional(),
    }),
  }),

  store: z.object({
    body: z.object({
      type_name: z.string().min(1),
      energy_type_id: z.coerce.number({ error: 'ID Tipe Energi wajib diisi' }),
      unit: z.string({ error: 'Satuan (unit) wajib diisi' }).min(1),
    }),
  }),

  patch: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID harus disertakan' }),
    }),
    body: z.object({
      type_name: z.string().min(1).optional(),
      energy_type_id: z.coerce.number().optional(),
      unit: z.string().min(1).optional(),
    }),
  }),

  remove: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID wajib disertakan untuk menghapus' }),
    }),
  }),
};

export type ReadingTypePayload = z.infer<typeof readingTypesSchema.store>['body'];
export type UpdateReadingTypePayload = z.infer<typeof readingTypesSchema.patch>['body'];
