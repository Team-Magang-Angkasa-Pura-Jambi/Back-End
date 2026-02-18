import { authMiddleware } from '../../middleware/auth.middleware.js';
import { type Router } from 'express';
import { auditLogController } from './audit-log.controller.js';
import { validate } from '../../utils/validate.js';
import { auditLogQuerySchema } from './audit-log.schema.js';

export const auditLogsRouter = (router: Router) => {
  const prefix = '/audit-logs';

  router.use(authMiddleware);

  router.get(prefix + '/', validate(auditLogQuerySchema), auditLogController.show);
  router.patch(prefix + '/:id', auditLogController.forbidden);
  router.put(prefix + '/:id', auditLogController.forbidden);
  router.delete(prefix + '/:id', auditLogController.forbidden);
};
