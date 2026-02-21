import z from 'zod';
const readingTypeBody = z.object({
  type_name: z.string({ error: 'Nama bacaan wajib diisi' }).min(1),
  unit: z.string({ error: 'Satuan unit wajib diisi' }).min(1),
  // energy_type_id opsional jika dikirim nested, karena ID baru dibuat oleh database
});
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
      // Tambahkan array reading_types di sini
      reading_types: z.array(readingTypeBody).optional(),
    }),
  }),

  patch: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID Energi harus diisi' }),
    }),
    body: z.object({
      name: z.string().min(1).optional(),
      unit_standard: z.string().min(1).optional(),
      // is_active: z.boolean().optional(),
      // Tambahkan nested reading types untuk mendukung update sekaligus
      reading_types: z
        .array(
          z.object({
            reading_type_id: z.number().optional(), // Jika ada ID = Update, jika tidak ada = Create
            type_name: z.string().min(1),
            unit: z.string().min(1),
          }),
        )
        .optional(),
    }),
  }),

  remove: z.object({
    params: z.object({
      id: z.coerce.number({ error: 'ID Energi harus diisi' }),
    }),
  }),
};

export type EnergyBodyPayload = z.infer<typeof energiesSchema.store>['body'];
