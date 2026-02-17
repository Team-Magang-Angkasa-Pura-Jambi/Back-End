import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/customError.js';
import { ZodError } from 'zod';
import { res500 } from '../utils/response.js';
import { Prisma } from '../generated/prisma/index.js';

const cleanStack = (stack?: string) => {
  if (!stack) return '';
  return stack
    .split('\n')
    .filter((line) => !line.includes('node_modules') && !line.includes('internal/modules'))
    .join('\n');
};

export const handleNotFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new HttpError(
    404,
    `Resource not found at ${req.method} ${req.originalUrl}`,
    'NotFoundError',
  );
  next(error);
};

export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  const cleanedError = {
    ...error,
    message: error.message,
    stack: cleanStack(error.stack),
  };

  if (error instanceof ZodError) {
    const formattedErrors: Record<string, string[]> = {};

    error.issues.forEach((issue) => {
      let fieldName = issue.path.slice(1).join('.');

      if (!fieldName) {
        fieldName = issue.path[0]?.toString() || 'unknown';
      }

      if (!formattedErrors[fieldName]) {
        formattedErrors[fieldName] = [];
      }

      formattedErrors[fieldName].push(issue.message);
    });

    return res.status(400).json({
      status: {
        code: 400,
        message: 'Validasi gagal. Cek kembali data Anda.',
      },
      errors: formattedErrors, // Gunakan object yang sudah kita format
    });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[]) || [];

      const field = target[0] ? target[0].charAt(0).toUpperCase() + target[0].slice(1) : 'Data';

      return res.status(409).json({
        status: {
          code: 409,

          message: `Gagal! ${field} tersebut sudah terdaftar di sistem.`,
        },
      });
    }
  }
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      status: {
        code: error.statusCode,
        message: error.message,
      },
      ...(error.errors && { errors: error.errors }),
    });
  }

  return res500({
    res,
    message: 'Terjadi kesalahan internal pada server.',

    error: process.env.NODE_ENV === 'development' ? error : undefined,
    // error: error,
  });
};
