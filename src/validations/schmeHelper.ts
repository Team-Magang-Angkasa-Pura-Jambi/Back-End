import { z } from 'zod';

/**
 * Helper untuk validasi string wajib diisi
 */
export const requiredString = (fieldName: string) =>
  z
    .string({ error: `${fieldName} wajib diisi.` })
    .trim()
    .min(1, { message: `${fieldName} tidak boleh kosong.` });

/**
 * Helper untuk validasi integer positif
 */
export const positiveInt = (fieldName: string) =>
  z.coerce
    .number({ error: `${fieldName} wajib diisi.` })
    .int({ message: `${fieldName} harus berupa bilangan bulat.` })
    .positive({ message: `${fieldName} harus merupakan angka positif.` });
