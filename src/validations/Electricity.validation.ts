import { z } from 'zod';

export const getOneElectricalById = z.object({
  params: z.object({
    id: z.coerce
      .number({
        error: 'ID parameter harus berupa format angka.',
      })
      .positive('ID parameter harus merupakan angka positif.')
      .int('ID parameter harus berupa bilangan bulat.'),
  }),
});
