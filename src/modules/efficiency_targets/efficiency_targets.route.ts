// Generated for Sentinel Project

import { type Router } from 'express';
import { validate } from '../../utils/validate.js';
import { efficiencySchema } from './efficiency_targets.schema.js';
import { efficiencyController } from './efficiency_targets.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const efficiencyRoute = (router: Router) => {
  const prefix = '/efficiency';

  router.get(prefix, validate(efficiencySchema.show), asyncHandler(efficiencyController.show));
  router.get(
    prefix + '/:id',
    validate(efficiencySchema.show),
    asyncHandler(efficiencyController.show),
  );

  router.post(prefix, validate(efficiencySchema.store), asyncHandler(efficiencyController.store));

  router.patch(
    prefix + '/:id',
    validate(efficiencySchema.update),
    asyncHandler(efficiencyController.patch),
  );
  router.delete(
    prefix + '/:id',
    validate(efficiencySchema.remove),
    asyncHandler(efficiencyController.remove),
  );

  // router.post(
  //   prefix + '/preview',
  //   validate(efficiencySchema.previewEfficiency),
  //   asyncHandler(efficiencyController.previewEfficiency),
  // );
};
