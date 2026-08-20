import { type Router } from 'express';
import { metersController } from './meters.controller.js';
import { validate } from '../../utils/validate.js';
import { meterSchema } from './meters.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const metersRoute = (router: Router) => {
  const prefix = '/meters';

  router.get(prefix, validate(meterSchema.show), asyncHandler(metersController.show));

  router.get(prefix + '/:id', validate(meterSchema.show), asyncHandler(metersController.show));

  router.post(prefix, validate(meterSchema.store), asyncHandler(metersController.store));

  router.patch(prefix + '/:id', validate(meterSchema.patch), asyncHandler(metersController.update));

  router.delete(
    prefix + '/:id',
    validate(meterSchema.remove),
    asyncHandler(metersController.remove),
  );
};
