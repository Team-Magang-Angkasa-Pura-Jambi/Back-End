import type { Request, Response, NextFunction } from 'express';
import { type ZodObject } from 'zod';

export const validate =
  (schema: ZodObject) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      res.locals.validatedData = {
        ...(res.locals.validatedData ?? {}),
        ...validatedData,
      };
      return next();
    } catch (err) {
      return next(err);
    }
  };
