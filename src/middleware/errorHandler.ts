import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from 'express';
import { HttpError } from '../utils/customError.js';
import { ZodError } from 'zod';

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

export const handleOther: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = 500;
  if (err instanceof HttpError) {
    statusCode = err.statusCode;
  } else if (err instanceof ZodError) {
    statusCode = 400;
  }

  let message = 'Internal Server Error';
  if (statusCode < 500) {
    message = err.message;
  }

  let errorData = null;
  if (err instanceof ZodError) {
    message = 'Input tidak valid.';

    errorData = err.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));
  }
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack || err);
  } else if (statusCode >= 500) {
    console.error(err.stack || err);
  }

  res.status(statusCode).json({
    status: {
      code: statusCode,
      message,
    },
    data: errorData,
  });
};
