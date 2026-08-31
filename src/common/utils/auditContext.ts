import { type Request, type Response, type NextFunction } from 'express';
import { contextStorage } from './context.js';

export const auditContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;

  const store = {
    userId: user?.id ?? 0,
    ipAddress: req.ip ?? req.socket.remoteAddress ?? 'unknown',
    userAgent: req.get('User-Agent') ?? 'unknown',
  };

  contextStorage.run(store, () => {
    next();
  });
};
