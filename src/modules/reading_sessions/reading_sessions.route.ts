import { type Router } from 'express';
import { validate } from '../../utils/validate.js';
import { readingSchema } from './reading_sessions.schema.js';
import { readingController } from './reading_sessions.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const readingRoute = (router: Router) => {
  const prefix = '/reading-sessions';

  router.post(prefix, validate(readingSchema.store), asyncHandler(readingController.store));
  router.get(prefix, validate(readingSchema.show), asyncHandler(readingController.show));
  router.delete(
    `${prefix}/:id`,
    validate(readingSchema.remove),
    asyncHandler(readingController.remove),
  );
};
