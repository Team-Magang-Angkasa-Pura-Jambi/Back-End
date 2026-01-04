import type { Response } from 'express';
import type { HttpError } from './customError.js';

interface ResponseParams {
  res: Response;
  message: string;
}

interface SuccessResponseParams<T, M = any> extends ResponseParams {
  data?: T;
  meta?: M;
}

interface ErrorResponseParams extends ResponseParams {
  error?: Error | HttpError;
}

export const res200 = <T>({
  res,
  message,
  data,
  meta,
}: SuccessResponseParams<T>) => {
  return res.status(200).json({
    status: {
      code: 200,
      message,
    },
    data,
    meta,
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
