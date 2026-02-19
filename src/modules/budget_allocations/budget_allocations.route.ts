import { type Router } from 'express';
import { validate } from '../../utils/validate.js';
import { allocationSchema } from './budget_allocations.schema.js';
import { allocationController } from './budget_allocations.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const allocationRoute = (router: Router) => {
  const prefix = '/budget-allocations';

  router.get(prefix, validate(allocationSchema.show), asyncHandler(allocationController.show));
  router.get(
    `${prefix}/:id`,
    validate(allocationSchema.show),
    asyncHandler(allocationController.show),
  );
  router.post(prefix, validate(allocationSchema.store), asyncHandler(allocationController.store));
  router.patch(
    `${prefix}/:id`,
    validate(allocationSchema.patch),
    asyncHandler(allocationController.update),
  );
  router.delete(
    `${prefix}/:id`,
    validate(allocationSchema.remove),
    asyncHandler(allocationController.remove),
  );
};
