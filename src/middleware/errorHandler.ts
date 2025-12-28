import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/customError.js';
import { ZodError } from 'zod';
import { res500 } from '../utils/response.js';

export const handleNotFound = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error = new HttpError(
    404,
    `Resource not found at ${req.method} ${req.originalUrl}`,
    'NotFoundError'
  );
  next(error);
};

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(error.stack || error);

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      status: {
        code: error.statusCode,
        message: error.message,
      },
      ...(error.errors && { errors: error.errors }),
    });
  }

  if (error instanceof ZodError) {
    const structuredErrors = error.flatten();
    return res.status(400).json({
      status: {
        code: 400,
        message:
          'Input tidak valid. Silakan periksa kembali data yang Anda kirim.',
      },
      errors: {
        formErrors: structuredErrors.formErrors,
        fieldErrors: structuredErrors.fieldErrors,  
      },
    });
  }

  return res500({
    res,
    message: 'Terjadi kesalahan internal pada server.',
    error: error,
  });
};
