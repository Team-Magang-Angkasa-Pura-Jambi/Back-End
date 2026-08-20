import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/customError.js';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/index.js';
import { serverLoggerService } from '../modules/system_monitor/server_logger.service.js';

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
    `Rute atau resource tidak ditemukan pada endpoint: [${req.method}] ${req.originalUrl}`,
    'NotFoundError',
  );
  next(error);
};

export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  const isDev = process.env.NODE_ENV === 'development' || req.query.debug === 'true';

  const requestContext = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.socket.remoteAddress,
    query: req.query,
    params: req.params,
    body: req.method !== 'GET' ? req.body : undefined,
  };

  let statusCode = 500;
  let clientMessage = 'Terjadi kesalahan internal pada server.';
  let errorName = error.name || 'InternalServerError';
  let errorCode = error.code || undefined;
  let formattedErrors: Record<string, string[]> | undefined = undefined;
  let hints: string[] = [];

  // 1. Zod Validation Error (400)
  if (error instanceof ZodError) {
    statusCode = 400;
    errorName = 'ValidationError';
    clientMessage = 'Validasi data payload gagal. Cek kembali parameter yang dikirim.';
    formattedErrors = {};

    error.issues.forEach((issue) => {
      let fieldName = issue.path.slice(1).join('.');
      if (!fieldName) {
        fieldName = issue.path[0]?.toString() || 'root';
      }
      if (!formattedErrors![fieldName]) {
        formattedErrors![fieldName] = [];
      }
      formattedErrors![fieldName].push(issue.message);
    });
    hints.push('Pastikan tipe data, format string/number, dan field wajib sudah sesuai skema.');
  }

  // 2. Prisma Database Errors
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    errorName = `PrismaError_${error.code}`;
    errorCode = error.code;

    switch (error.code) {
      case 'P2002': {
        statusCode = 409;
        const target = (error.meta?.target as string[]) || [];
        const field = target[0] ? target[0].toUpperCase() : 'Data';
        clientMessage = `Gagal! Field unik [${field}] tersebut sudah terdaftar di sistem.`;
        hints.push('Gunakan data/kode yang belum pernah terdaftar sebelumnya.');
        break;
      }
      case 'P2025': {
        statusCode = 404;
        clientMessage = 'Data record yang ingin diakses/diperbarui tidak ditemukan di database.';
        hints.push('Periksa kembali ID record yang dipassing di URL params atau request body.');
        break;
      }
      case 'P2003': {
        statusCode = 400;
        const fieldName = (error.meta?.field_name as string) || 'Foreign Key';
        clientMessage = `Gagal Foreign Key Constraint! Relasi data pada [${fieldName}] tidak valid atau record induk tidak ditemukan.`;
        hints.push('Pastikan ID foreign key (misal: user_id, meter_id, location_id) benar-benar ada di tabel master terkait.');
        break;
      }
      case 'P2021': {
        statusCode = 500;
        const table = (error.meta?.table as string) || 'unknown';
        clientMessage = `Tabel database [${table}] belum dibuat di PostgreSQL.`;
        hints.push('Jalankan "npx prisma db push" pada Back-End untuk menyinkronkan skema prisma ke PostgreSQL.');
        break;
      }
      case 'P2000': {
        statusCode = 400;
        clientMessage = 'Nilai yang dimasukkan melebihi kapasitas panjang kolom database.';
        hints.push('Perpendek teks atau sesuaikan tipe varchar di schema prisma.');
        break;
      }
      default: {
        statusCode = 500;
        clientMessage = `Database Error [${error.code}]: ${error.message}`;
      }
    }
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    errorName = 'PrismaValidationError';
    clientMessage = 'Query database Prisma tidak valid. Parameter query atau tipe data tidak sesuai skema.';
    hints.push('Periksa argumen yang diteruskan ke pemanggilan fungsi Prisma Client.');
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 503;
    errorName = 'DatabaseConnectionError';
    clientMessage = 'Gagal terhubung ke database PostgreSQL. Server database mungkin offline atau kredensial salah.';
    hints.push('Pastikan service PostgreSQL aktif dan DATABASE_URL di file .env sudah benar.');
  }

  // 3. Custom HttpError
  else if (error instanceof HttpError) {
    statusCode = error.statusCode;
    clientMessage = error.message;
    errorName = error.name || 'HttpError';
    formattedErrors = error.errors;
  }

  // 4. Axios / Microservice Errors
  else if (error.isAxiosError) {
    statusCode = error.response?.status || 502;
    errorName = 'MicroserviceConnectionError';
    const targetUrl = error.config?.url || 'target API';
    clientMessage = `Gagal berkomunikasi dengan layanan eksternal di [${targetUrl}].`;
    hints.push('Pastikan microservice (misal: FastAPI Machine Learning atau OpenWeather) sedang berjalan.');
  }

  // 5. JWT Authentication Errors
  else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    statusCode = 401;
    errorName = 'AuthenticationError';
    clientMessage = error.name === 'TokenExpiredError'
      ? 'Sesi login telah kedaluwarsa. Silakan login kembali.'
      : 'Token autentikasi tidak valid.';
    hints.push('Login kembali untuk mendapatkan token JWT Bearer yang baru.');
  }

  // 6. Generic Default Fallback
  else if (error.message) {
    clientMessage = error.message;
  }

  // Record to In-Memory Server Monitoring Logger
  serverLoggerService.log('ERROR', clientMessage, 'ErrorHandler', {
    statusCode,
    request: requestContext,
    error: {
      name: errorName,
      message: error.message || clientMessage,
      code: errorCode,
      stack: cleanStack(error.stack),
      meta: error.meta,
    },
  });

  const responsePayload: Record<string, any> = {
    status: {
      code: statusCode,
      message: clientMessage,
    },
    ...(formattedErrors && { errors: formattedErrors }),
  };

  // If in Development mode, append rich Debug details for pair programming and instant diagnostics
  if (isDev) {
    responsePayload.debug = {
      timestamp: new Date().toISOString(),
      error_type: errorName,
      error_code: errorCode,
      raw_message: error.message,
      request: requestContext,
      hints: hints.length > 0 ? hints : undefined,
      stack: cleanStack(error.stack),
    };
  }

  return res.status(statusCode).json(responsePayload);
};
