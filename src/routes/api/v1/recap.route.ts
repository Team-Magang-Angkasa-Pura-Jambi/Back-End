import { Router } from 'express';
import { recapController } from '../../../controllers/report/recap.controller.js';
import {
  getRecapSchema,
  recalculateRecapSchema,
} from '../../../validations/recap.validation.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { validate } from '../../../utils/validate.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import { RoleName } from '../../../generated/prisma/index.js';

export default (router: Router) => {
  const prefix = '/recap';

  // Endpoint untuk rekap umum (Listrik, Air, BBM)
  router.get(
    prefix,
    authorize(RoleName.Admin, RoleName.SuperAdmin, RoleName.Technician),
    validate(getRecapSchema),
    asyncHandler(recapController.getRecap)
  );

  // Endpoint untuk memicu kalkulasi ulang data rekap
  router.post(
    prefix + '/recalculate',
    authorize(RoleName.Admin, RoleName.SuperAdmin),
    validate(recalculateRecapSchema),
    asyncHandler(recapController.recalculateRecap)
  );
};
