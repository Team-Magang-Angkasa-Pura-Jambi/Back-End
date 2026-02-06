import { type Router } from 'express';
import { authMiddleware, authorize } from '../../../middleware/auth.middleware.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { validate } from '../../../utils/validate.js';
import { dailyLogbookController } from '../../../controllers/operations/dailyLogbook.controller.js';
import {
  deleteLogbookSchema,
  generateLogbookSchema,
  getLogbookByIdSchema,
  getLogbooksSchema,
  updateLogbookSchema,
} from '../../../validations/operations/dailyLogbook.validation.js';

export default (router: Router) => {
  const prefix = '/logbooks';

  router.use(prefix, authMiddleware);

  router.get(
    prefix,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getLogbooksSchema),
    asyncHandler(dailyLogbookController.getAll),
  );

  router.get(
    `${prefix}/:logId`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getLogbookByIdSchema),
    asyncHandler(dailyLogbookController.getById),
  );

  router.post(
    `${prefix}/generate`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(generateLogbookSchema),
    asyncHandler(dailyLogbookController.generate),
  );

  router.patch(
    `${prefix}/:logId`,
    authorize('Admin', 'SuperAdmin'),
    validate(updateLogbookSchema),
    asyncHandler(dailyLogbookController.update),
  );

  router.delete(
    `${prefix}/:logId`,
    authorize('SuperAdmin'),
    validate(deleteLogbookSchema),
    asyncHandler(dailyLogbookController.delete),
  );
};
