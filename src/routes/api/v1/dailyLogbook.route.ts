import type { Router } from 'express';
import { dailyLogbookController } from '../../../controllers/dailyLogbook.controller.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../utils/validate.js';
import {
  generateLogbookBodySchema,
  getLogbooksQuerySchema,
  logbookSchemas,
} from '../../../validations/dailyLogbook.validation.js';

export default (router: Router) => {
  const prefix = '/logbooks';

  // GET /api/v1/logbooks - Mengambil daftar logbook
  router.get(
    prefix,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getLogbooksQuerySchema),
    dailyLogbookController.getAll
  );

  // GET /api/v1/logbooks/:logId - Mengambil satu logbook
  router.get(
    `${prefix}/:logId`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(logbookSchemas.byId),
    dailyLogbookController.getById
  );

  // Endpoint untuk memicu pembuatan logbook secara manual.
  // Hanya bisa diakses oleh SuperAdmin.
  router.post(
    `${prefix}/generate`,
    authorize('SuperAdmin'),
    validate(generateLogbookBodySchema),
    dailyLogbookController.generateLog
  );

  router.use(prefix, router);
};
