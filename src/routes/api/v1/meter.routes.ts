import type { Router } from 'express';
import { MeterController } from '../../../controllers/meter.controller.js';
import { meterService, MeterService } from '../../../services/meter.service.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import {
  createMeterSchema,
  idParamsSchema,
  updateMeterSchema,
} from '../../../validations/meter.validation.js';
import { validate } from '../../../utils/validate.js';

export const meterRoutes = (router: Router) => {
  const prefix = '/meters';

  const meterController = new MeterController(meterService);

  router.get(prefix, asyncHandler(meterController.getAll));
  router.get(`${prefix}-active`, asyncHandler(meterController.getAllActive));

  router.get(
    `${prefix}/:id`,
    validate(idParamsSchema),
    asyncHandler(meterController.getById)
  );

  router.post(
    prefix,
    validate(createMeterSchema),
    asyncHandler(meterController.create)
  );

  router.put(
    `${prefix}/:id`,
    validate(idParamsSchema),
    validate(updateMeterSchema),
    asyncHandler(meterController.update)
  );

  router.delete(
    `${prefix}/:id`,
    validate(idParamsSchema),
    asyncHandler(meterController.delete)
  );
};
