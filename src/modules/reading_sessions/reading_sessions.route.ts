import { type Router } from 'express';
import multer from 'multer';
import { validate } from '../../utils/validate.js';
import { readingSchema } from './reading_sessions.schema.js';
import { readingController } from './reading_sessions.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authorize } from '../../middleware/auth.middleware.js';
import { RoleType } from '../../generated/prisma/index.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export const readingRoute = (router: Router) => {
  const prefix = '/reading-sessions';

  // Superadmin-only dynamic import & template endpoints
  router.get(
    `${prefix}/import/template`,
    authorize(RoleType.SUPER_ADMIN),
    validate(readingSchema.downloadTemplate),
    asyncHandler(readingController.downloadTemplate),
  );

  router.post(
    `${prefix}/import`,
    authorize(RoleType.SUPER_ADMIN),
    upload.single('file'),
    validate(readingSchema.importData),
    asyncHandler(readingController.importData),
  );

  router.post(prefix, validate(readingSchema.store), asyncHandler(readingController.store));
  router.get(prefix, validate(readingSchema.show), asyncHandler(readingController.show));
  router.post(
    prefix + '/recalculate',
    validate(readingSchema.recalculate),
    asyncHandler(readingController.recalculate),
  );
  router.patch(
    `${prefix}/:id`,
    validate(readingSchema.update),
    asyncHandler(readingController.patch),
  );

  router.get(
    `${prefix}/last`,
    validate(readingSchema.lastReading),
    asyncHandler(readingController.getLastReading),
  );
  router.get(
    `${prefix}/last-reading`,
    validate(readingSchema.lastReading),
    asyncHandler(readingController.getLastReading),
  );
  router.get(
    '/readings/last',
    validate(readingSchema.lastReading),
    asyncHandler(readingController.getLastReading),
  );

  router.delete(
    `${prefix}/:id`,
    validate(readingSchema.remove),
    asyncHandler(readingController.remove),
  );
};

