import { Router } from 'express';
import { recapController } from '../../../controllers/recap.controller.js';

import { getRecapSchema } from '../../../validations/recap.validation.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { authorize } from '../../../middleware/auth.middleware.js';

export default (router: Router) => {
  router.get(
    '/recap',
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getRecapSchema),
    asyncHandler(recapController.getRecap)
  );
};
