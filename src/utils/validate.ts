import type { Request, Response, NextFunction } from 'express';
import type { ParamsDictionary, Query } from 'express-serve-static-core';
import { ZodError, type ZodObject } from 'zod';

export const validate =
  (schema: ZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedSchema = await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      res.locals.validatedData = parsedSchema;
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: 'fail',
          errors: error.flatten().fieldErrors,
        });
      }

      return next(error);
    }
  };
