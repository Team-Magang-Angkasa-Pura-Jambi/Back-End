import { Router } from 'express';
import {
  authMiddleware,
  authorize,
} from '../../../middleware/auth.middleware.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { validate } from '../../../utils/validate.js';
import { dailyLogbookController } from '../../../controllers/dailyLogbook.controller.js';
import {
  deleteLogbookSchema,
  generateLogbookSchema,
  getLogbookByIdSchema,
  getLogbooksSchema,
  updateLogbookSchema,
} from '../../../validations/dailyLogbook.validation.js';

export default (router: Router) => {
  const prefix = '/logbooks';

  router.use(prefix, authMiddleware);

  // GET /api/v1/logbooks - Mengambil semua logbook dengan filter dan paginasi
  router.get(
    prefix,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getLogbooksSchema),
    asyncHandler(dailyLogbookController.getAll)
  );

  // GET /api/v1/logbooks/:logId - Mengambil satu logbook berdasarkan ID
  router.get(
    `${prefix}/:logId`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(getLogbookByIdSchema),
    asyncHandler(dailyLogbookController.getById)
  );

  // POST /api/v1/logbooks/generate - Membuat logbook harian secara otomatis
  router.post(
    `${prefix}/generate`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(generateLogbookSchema),
    asyncHandler(dailyLogbookController.generate)
  );

  // PATCH /api/v1/logbooks/:logId - Memperbarui catatan manual pada logbook
  router.patch(
    `${prefix}/:logId`,
    authorize('Admin', 'SuperAdmin'),
    validate(updateLogbookSchema),
    asyncHandler(dailyLogbookController.update)
  );

  // DELETE /api/v1/logbooks/:logId - Menghapus logbook
  router.delete(
    `${prefix}/:logId`,
    authorize('SuperAdmin'), // Hanya SuperAdmin yang boleh menghapus
    validate(deleteLogbookSchema),
    asyncHandler(dailyLogbookController.delete)
  );
};
