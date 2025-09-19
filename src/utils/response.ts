import type { Response } from 'express';
import type { HttpError } from './customError.js';

// --- Definisi Tipe Data untuk Respons ---

// Tipe dasar untuk semua parameter helper
interface ResponseParams {
  res: Response;
  message: string;
}

// Tipe untuk respons sukses yang bisa membawa data generik
interface SuccessResponseParams<T> extends ResponseParams {
  data?: T;
}

// Tipe untuk respons error yang bisa membawa objek error
interface ErrorResponseParams extends ResponseParams {
  error?: Error | HttpError;
}

// --- Helper untuk Respons Sukses ---

/**
 * Mengirim respons sukses 200 OK.
 * @param res - Objek Response dari Express.
 * @param message - Pesan sukses.
 * @param data - (Opsional) Payload data yang akan dikirim.
 */
export const res200 = <T>({ res, message, data }: SuccessResponseParams<T>) => {
  return res.status(200).json({
    status: {
      code: 200,
      message,
    },
    data,
  });
};

/**
 * Mengirim respons sukses 201 Created.
 * @param res - Objek Response dari Express.
 * @param message - Pesan sukses.
 * @param data - (Opsional) Payload data yang baru dibuat.
 */
export const res201 = <T>({ res, message, data }: SuccessResponseParams<T>) => {
  return res.status(201).json({
    status: {
      code: 201,
      message,
    },
    data,
  });
};

// --- Helper untuk Respons Error ---

/**
 * Mengirim respons error 404 Not Found.
 * @param res - Objek Response dari Express.
 * @param message - Pesan error.
 */
export const res404 = ({ res, message }: ResponseParams) => {
  return res.status(404).json({
    status: {
      code: 404,
      message,
    },
    data: null,
  });
};

/**
 * Mengirim respons error 500 Internal Server Error dengan aman.
 * @param res - Objek Response dari Express.
 * @param message - Pesan error umum.
 * @param error - (Opsional) Objek error asli untuk debugging di mode development.
 */
export const res500 = ({ res, message, error }: ErrorResponseParams) => {
  const responseBody: {
    status: { code: number; message: string };
    error?: { name: string; message: string };
  } = {
    status: {
      code: 500,
      message,
    },
  };

  // Hanya tampilkan detail error jika dalam mode development
  if (process.env.NODE_ENV === 'development' && error) {
    responseBody.error = {
      name: error.name,
      message: error.message,
    };
  }

  return res.status(500).json(responseBody);
};
