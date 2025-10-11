import { Router } from 'express';
import {
  authMiddleware,
  authorize,
} from '../../../middleware/auth.middleware.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { alertController } from '../../../controllers/alert.controller.js';
import {
  alertIdParamSchema,
  emptySchema,
  getAlertsSchema,
} from '../../../validations/alert.validation.js';

export default (router: Router) => {
  const prefix = '/alerts';

  router.get(
    prefix,
    validate(getAlertsSchema),
    asyncHandler(alertController.getAll)
  );

  router.get(
    `${prefix}/unread-count`,

    validate(emptySchema),
    asyncHandler(alertController.getUnreadCount)
  );

  router.patch(
    `${prefix}/acknowledge-all`,

    validate(emptySchema),
    asyncHandler(alertController.acknowledgeAll)
  );

  router.patch(
    `${prefix}/:alertId/acknowledge`,
    validate(alertIdParamSchema),
    asyncHandler(alertController.acknowledge)
  );
};
