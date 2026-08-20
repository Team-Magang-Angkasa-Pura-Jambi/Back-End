import { type Router } from 'express';
import { validate } from '../../utils/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { configSchema } from './meter_reading_configs.schema.js';
import { meterConfigsController } from './meter_reading_configs.controller.js';

export const meterConfigsRoute = (router: Router) => {
  const prefix = '/meter-reading-configs';

  router.get(
    prefix,
    // authMiddleware,
    validate(configSchema.show),
    asyncHandler(meterConfigsController.show),
  );

  router.get(
    `${prefix}/:id`,
    // authMiddleware,
    validate(configSchema.show),
    asyncHandler(meterConfigsController.show),
  );

  router.post(
    prefix,
    // authMiddleware,
    validate(configSchema.store),
    asyncHandler(meterConfigsController.store),
  );

  router.patch(
    `${prefix}/:id`,
    // authMiddleware,
    validate(configSchema.patch),
    asyncHandler(meterConfigsController.update),
  );

  router.delete(
    `${prefix}/:id`,
    // authMiddleware,
    validate(configSchema.remove),
    asyncHandler(meterConfigsController.remove),
  );
};
