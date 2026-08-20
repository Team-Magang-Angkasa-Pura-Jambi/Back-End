import { parsePhoneNumberFromString } from 'libphonenumber-js';
import z from 'zod';

export const phoneSchema = z.string().refine(
  (val) => {
    const phoneNumber = parsePhoneNumberFromString(val, 'ID'); // 'ID' untuk default Indonesia
    return phoneNumber?.isValid();
  },
  {
    message: 'Nomor telepon hanya boleh angka (Contoh: 08123456789)',
  },
);
