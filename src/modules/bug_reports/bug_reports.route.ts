import { type Router } from 'express';
import { validate } from '../../utils/validate.js';
import { bugReportSchema } from './bug_reports.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { bugReportController } from './bug_reports.controller.js';

export const bugReportRoute = (router: Router) => {
  const prefix = '/bug-reports';

  // Public / Authenticated user creates a report
  router.post(prefix, validate(bugReportSchema.store), asyncHandler(bugReportController.store));

  // SuperAdmin & Admin views reports
  router.get(prefix, validate(bugReportSchema.show), asyncHandler(bugReportController.show));

  // Get specific report detail
  router.get(`${prefix}/:id`, validate(bugReportSchema.show), asyncHandler(bugReportController.show));

  // Update status & developer response
  router.patch(
    `${prefix}/:id`,
    validate(bugReportSchema.updateStatus),
    asyncHandler(bugReportController.updateStatus),
  );

  // Delete report
  router.delete(
    `${prefix}/:id`,
    validate(bugReportSchema.remove),
    asyncHandler(bugReportController.remove),
  );
};
