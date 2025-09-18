import type { Router } from 'express';
import { ReadingService } from '../../../services/reading.service.js';
import { ReadingController } from '../../../controllers/reading.controller.js';
import { validate } from '../../../utils/validate.js';
import {
  createCorrectionSchema,
  createReadingSessionSchema,
  getByIdSchema,
  getReadingsSchema,
} from '../../../validations/reading.validation.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export const readingRoutes = (router: Router) => {
  const prefix = '/readings';
  const readingService = new ReadingService();
  const readingController = new ReadingController(readingService);

  router
    .route(prefix)
    .get(
      validate(getReadingsSchema),
      asyncHandler(readingController.getReadings)
    )
    .post(
      validate(createReadingSessionSchema),
      asyncHandler(readingController.create)
    );

  router
    .route(`${prefix}/:id`)
    .get(validate(getByIdSchema), asyncHandler(readingController.getById))
    .delete(validate(getByIdSchema), asyncHandler(readingController.delete));

  router.post(
    `${prefix}/:id/correct`,
    // validate(getByIdSchema), // Validasi ID di URL
    validate(createCorrectionSchema), // Validasi body
    asyncHandler(readingController.createCorrection)
  );
};
