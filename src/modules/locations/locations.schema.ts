import z from 'zod';

export const locationSchema = {
  store: z.object({
    body: z.object({ name: z.string().min(1), parent_id: z.number().optional() }),
  }),
  show: z.object({
    query: z.object({ name: z.string().optional() }),
    params: z.object({ id: z.coerce.number().optional() }),
  }),
  patch: z.object({
    params: z.object({ id: z.coerce.number({ error: 'ID Lokasi harus diisi' }) }),
    body: z.object({ name: z.string().min(1).optional() }),
  }),
  remove: z.object({
    params: z.object({ id: z.coerce.number({ error: 'ID Lokasi harus diisi' }) }),
  }),
};
