import { z } from 'zod';

/**
 * Helper untuk validasi string wajib diisi
 */
export const requiredString = (fieldName: string) =>
  z
    .string({ error: `${fieldName} wajib diisi.` })
    .trim()
    .min(1, { message: `${fieldName} tidak boleh kosong.` });

export const zodString = (fieldName: string) =>
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

export const positiveNumber = (fieldName: string) =>
  z.coerce
    .number({
      message: `${fieldName} harus berupa angka.`,
    })
    .positive({ message: `${fieldName} harus merupakan angka positif.` });

export const optionalString = (fieldName: string) =>
  z
    .string({ error: `${fieldName} wajib diisi.` })
    .trim()

    .optional();

export const isoDate = (fieldName: string) =>
  z.coerce.date({
    error: `${fieldName} harus berupa tanggal dengan format yang valid (ISO 8601).`,
  });
