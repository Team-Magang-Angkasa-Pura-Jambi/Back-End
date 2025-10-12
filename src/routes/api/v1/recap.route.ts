import { Router } from 'express';
import { recapController } from '../../../controllers/recap.controller.js';

import {
  getRecapSchema,
  recalculateRecapSchema,
} from '../../../validations/recap.validation.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { authorize } from '../../../middleware/auth.middleware.js';

export default (router: Router) => {
  const prefix = '/recap';

  router.get(
    prefix, // PERBAIKAN: Gunakan prefix yang konsisten
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getRecapSchema),
    asyncHandler(recapController.getRecap)
  );

  router.post(
    prefix + '/recalculate',
    authorize('Admin', 'SuperAdmin', 'Technician'), // PERBAIKAN: Amankan endpoint
    validate(recalculateRecapSchema),
    recapController.recalculateRecap
  );
};
