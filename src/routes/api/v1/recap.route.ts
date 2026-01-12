import { type Router } from 'express';
import { recapController } from '../../../controllers/report/recap.controller.js';
import {
  getRecapSchema,
  recalculateRecapSchema,
} from '../../../validations/reports/recap.validation.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { validate } from '../../../utils/validate.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import { RoleName } from '../../../generated/prisma/index.js';

export default (router: Router) => {
  const prefix = '/recap';

  router.get(
    prefix,
    authorize(RoleName.Admin, RoleName.SuperAdmin, RoleName.Technician),
    validate(getRecapSchema),
    asyncHandler(recapController.getRecap),
  );

  router.post(
    prefix + '/recalculate',
    authorize(RoleName.Admin, RoleName.SuperAdmin),
    validate(recalculateRecapSchema),
    asyncHandler(recapController.recalculateRecap),
  );
};
