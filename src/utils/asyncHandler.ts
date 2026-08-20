import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Membungkus fungsi async untuk menangkap error secara otomatis
 * dan meneruskannya ke Global Error Handler Express.
 */
export const asyncHandler = (fn: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
