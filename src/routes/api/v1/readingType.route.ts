import type { Router } from 'express';
import { ReadingTypeService } from '../../../services/readingType.service.js';
import { ReadingTypeController } from '../../../controllers/readingType.controller.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import {
  createReadingTypeSchema,
  updateReadingTypeSchema,
} from '../../../validations/readingType.validation.js';
import { validate } from '../../../utils/validate.js';
import { getByIdSchema } from '../../../validations/reading.validation.js';

export const readingTypeRoutes = (router: Router) => {
  const prefix = '/reading-types';
  const readingTypeService = new ReadingTypeService();
  const readingTypeController = new ReadingTypeController(readingTypeService);

  router
    .route(prefix)
    .get(asyncHandler(readingTypeController.getAllReadingTypes))
    .post(
      validate(createReadingTypeSchema),
      asyncHandler(readingTypeController.createReadingType)
    );

  router
    .route(`${prefix}/:id`)
    .get(
      validate(getByIdSchema),
      asyncHandler(readingTypeController.getReadingTypeById)
    )
    .put(
      validate(getByIdSchema),
      validate(updateReadingTypeSchema),
      asyncHandler(readingTypeController.updateReadingType)
    )
    .delete(
      validate(getByIdSchema),
      asyncHandler(readingTypeController.deleteReadingType)
    );
};
