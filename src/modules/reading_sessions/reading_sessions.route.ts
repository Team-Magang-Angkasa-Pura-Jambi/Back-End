import { type Router } from 'express';
import { validate } from '../../utils/validate.js';
import { readingSchema } from './reading_sessions.schema.js';
import { readingController } from './reading_sessions.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const readingRoute = (router: Router) => {
  const prefix = '/reading-sessions';

  router.post(prefix, validate(readingSchema.store), asyncHandler(readingController.store));
  router.get(prefix, validate(readingSchema.show), asyncHandler(readingController.show));
  router.post(
    prefix + '/recalculate',
    validate(readingSchema.recalculate),
    asyncHandler(readingController.recalculate),
  );
  router.patch(
    `${prefix}/:id`,
    validate(readingSchema.update),
    asyncHandler(readingController.patch),
  );

  router.get(
    `${prefix}/last`,
    validate(readingSchema.lastReading),
    asyncHandler(readingController.getLastReading),
  );
  router.get(
    `${prefix}/last-reading`,
    validate(readingSchema.lastReading),
    asyncHandler(readingController.getLastReading),
  );
  router.get(
    '/readings/last',
    validate(readingSchema.lastReading),
    asyncHandler(readingController.getLastReading),
  );

  router.delete(
    `${prefix}/:id`,
    validate(readingSchema.remove),
    asyncHandler(readingController.remove),
  );
};
