import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

export type ExpressHandlerContext = {
  req: Request;
  res: Response;
  next: NextFunction;
};
declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload & { id: number };
  }
}
export interface CustomJwtPayload extends JwtPayload {
  id: number;
  username: string;
  role: number;
  jti: string;
}
