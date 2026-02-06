import { type Router } from 'express';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import { alertController } from '../../../controllers/notifications/alert.controller.js';
import {
  bulkDeleteAlertsSchema,
  getLatestAlertsSchema,
  updateAlertStatusSchema,
  bulkUpdateAlertsSchema,
} from '../../../validations/notifications/alert.validation.js';

export default (router: Router) => {
  const prefix = '/alerts';

  router.get(
    `${prefix}/meters`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    asyncHandler(alertController.getMeterAlerts),
  );

  router.get(
    `${prefix}/system`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    asyncHandler(alertController.getSystemAlerts),
  );

  router.get(
    `${prefix}/latest`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getLatestAlertsSchema),
    asyncHandler(alertController.getLatest),
  );

  router.patch(
    `${prefix}/bulk-update`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(bulkUpdateAlertsSchema),
    asyncHandler(alertController.bulkUpdateStatus),
  );

  router.patch(
    `${prefix}/:alertId`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(updateAlertStatusSchema),
    asyncHandler(alertController.updateStatus),
  );
  router.post(
    `${prefix}/bulk-delete`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(bulkDeleteAlertsSchema),
    asyncHandler(alertController.bulkDelete),
  );
};
