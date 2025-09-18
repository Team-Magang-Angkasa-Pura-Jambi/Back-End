import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodObject } from 'zod';
import { Error400 } from './customError.js';

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
        const errorList = Object.entries(error.flatten().fieldErrors)

          .map(([field, messages]) => {
            if (Array.isArray(messages)) {
              return `${field}: ${messages.join(', ')}`;
            }
            return null;
          })

          .filter((message) => message !== null);

        const errorMessages = errorList.join('; ');

        const finalMessage =
          errorMessages || error.flatten().formErrors.join(', ');

        throw new Error400(`Invalid input. Errors: ${finalMessage}`);
      }
      return next(error);
    }
  };
