import type { Router } from 'express';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { createReadingSessionSchema } from '../../../validations/Electricity.validation.js';
import { ElectricityController } from '../../../controllers/Electricity.controller.js';
import { electricityService } from '../../../services/Electricity.service.js';

export const electricityRoutes = (router: Router) => {
  const prefix = '/electricity';
  const electricityController = new ElectricityController(electricityService);

  router.get(prefix, asyncHandler(electricityController.getAll));

  router.get(`${prefix}/:id`, asyncHandler(electricityController.getById));

  router.post(
    prefix,
    validate(createReadingSessionSchema),
    asyncHandler(electricityController.create)
  );

  router.post(
    `${prefix}/:id/correct`,
    validate(createReadingSessionSchema),
    asyncHandler(electricityController.createCorrection)
  );

  router.delete(`${prefix}/:id`, asyncHandler(electricityController.delete));

  router.get(
    '/meters/:id/latest-reading',
    asyncHandler(electricityController.getLatestForMeter)
  );
};
