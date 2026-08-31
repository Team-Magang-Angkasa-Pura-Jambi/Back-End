import { type Router } from 'express';
import { pageGuidesController } from './page_guides.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { validate } from '../../utils/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { pageGuidesSchema } from './page_guides.schema.js';

export const pageGuidesRoute = (router: Router) => {
  const prefix = '/page-guides';

  // Public (for logged in users)
  router.get(prefix, authMiddleware, asyncHandler(pageGuidesController.index));
  router.get(
    `${prefix}/by-route`,
    authMiddleware,
    validate(pageGuidesSchema.show),
    asyncHandler(pageGuidesController.show),
  );

  // Super Admin only
  router.post(
    prefix,
    authMiddleware,
    validate(pageGuidesSchema.create),
    asyncHandler(pageGuidesController.store),
  );
  router.put(
    `${prefix}/:id`,
    authMiddleware,
    validate(pageGuidesSchema.patch),
    asyncHandler(pageGuidesController.patch),
  );
  router.delete(
    `${prefix}/:id`,
    authMiddleware,
    validate(pageGuidesSchema.patch), // we can reuse patch for params id validation
    asyncHandler(pageGuidesController.destroy),
  );
};
