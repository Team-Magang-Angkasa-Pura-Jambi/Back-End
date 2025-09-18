import type { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { electricityController } from '../../../controllers/Electricity.controller.js';
import { validate } from '../../../utils/validate.js';
import { getOneElectricalById } from '../../../validations/Electricity.validation.js';

export const electricityRoutes = (router: Router) => {
  const prefix = '/electricity';

  router.get(prefix, asyncHandler(electricityController.getAll));

  router.get(
    `${prefix}/:id`,
    validate(getOneElectricalById),
    asyncHandler(electricityController.getById)
  );

  router.get(
    '/meters/:id/latest-reading',
    asyncHandler(electricityController.getLatestForMeter)
  );
};
