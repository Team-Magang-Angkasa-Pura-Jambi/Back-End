import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodObject } from 'zod';
import { Error400 } from './customError.js';

export const validate =
  <T extends ZodObject>(schema: T) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const { body, params, query } = req;
    console.log(req.query);

    try {
      res.locals.validatedData = await schema.parseAsync({
        body,
        params,
        query,
      });

      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        const { fieldErrors, formErrors } = err.flatten();
        const errorMessages = [
          ...Object.entries(fieldErrors).flatMap(
            ([key, msgs]) => msgs?.map((m) => `${key}: ${m}`) ?? []
          ),
          ...formErrors,
        ];

        return next(new Error400(`Invalid input. ${errorMessages.join('; ')}`));
      }
      return next(err);
    }
  };
