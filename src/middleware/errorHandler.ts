import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from 'express';
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

// export const handleOther: ErrorRequestHandler = (err, req, res, next) => {
//   if (res.headersSent) {
//     return next(err);
//   }

//   let statusCode = 500;
//   if (err instanceof HttpError) {
//     statusCode = err.statusCode;
//   } else if (err instanceof ZodError) {
//     statusCode = 400;
//   }

//   let message = 'Internal Server Error';
//   if (statusCode < 500) {
//     message = err.message;
//   }

//   let errorData = null;
//   if (err instanceof ZodError) {
//     message = 'Input tidak valid.';

//     errorData = err.issues.map((issue) => ({
//       path: issue.path,
//       message: issue.message,
//     }));
//   }
//   if (process.env.NODE_ENV === 'development') {
//     console.error(err.stack || err);
//   } else if (statusCode >= 500) {
//     console.error(err.stack || err);
//   }

//   res.status(statusCode).json({
//     status: {
//       code: statusCode,
//       message,
//     },
//     data: errorData,
//   });
// };

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Selalu catat error ke konsol untuk debugging, terutama stack trace-nya.
  console.error(error.stack || error);

  // 1. Menangani error yang sudah kita kenali (dari service atau controller)
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      status: {
        code: error.statusCode,
        message: error.message,
      },
      // Hanya sertakan field `errors` jika ada isinya (misalnya dari validasi Zod)
      ...(error.errors && { errors: error.errors }),
    });
  }

  // 2. Menangani error validasi dari Zod secara spesifik sebagai fallback
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

  // 3. Menangani semua error lain yang tidak terduga (error 500)
  // [REVISI] Menggunakan response helper untuk konsistensi
  return res500({
    res,
    message: 'Terjadi kesalahan internal pada server.',
    error: error,
  });
};
