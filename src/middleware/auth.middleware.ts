import jwt from 'jsonwebtoken';

import type { NextFunction, Request, Response } from 'express';
import { Error401, Error403 } from '../utils/customError.js';
import type { CustomJwtPayload } from '../types/Express.type.js';
import { type RoleType } from '../generated/prisma/index.js';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const bearerToken = req.headers.authorization;
    if (!bearerToken) {
      throw new Error401('Token tidak ditemukan. Silakan login kembali.');
    }

    const token = bearerToken.split(' ')[1];
    if (!token) {
      throw new Error401('Format token salah.');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as CustomJwtPayload;

    if (typeof decoded !== 'object' || !decoded.id || !decoded.role) {
      throw new Error401('Token tidak valid atau isinya tidak lengkap.');
    }

    req.user = decoded;
    next();
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      next(new Error401('Token kedaluwarsa. Silakan login kembali.'));
    } else if (error instanceof Error && error.name === 'JsonWebTokenError') {
      next(new Error401('Token tidak valid. Silakan login kembali.'));
    } else {
      next(error);
    }
  }
};

export const authorize = (...allowedRoles: RoleType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new Error403('Akses ditolak. Informasi otentikasi tidak lengkap.');
      }

      const userRole = req.user.role;

      if (!allowedRoles.includes(userRole)) {
        throw new Error403('Akses ditolak. Anda tidak memiliki izin untuk melakukan aksi ini.');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
