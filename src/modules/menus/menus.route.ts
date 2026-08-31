import { type Router } from 'express';
import { menusController } from './menus.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { validate } from '../../utils/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { menusSchema } from './menus.schema.js';

export const menusRoute = (router: Router) => {
  const prefix = '/menus';

  router.get(prefix, authMiddleware, asyncHandler(menusController.index));
  router.get(`${prefix}/:id`, authMiddleware, asyncHandler(menusController.show));

  router.post(
    prefix,
    authMiddleware,
    validate(menusSchema.create),
    asyncHandler(menusController.store),
  );
  
  router.put(
    `${prefix}/:id`,
    authMiddleware,
    validate(menusSchema.patch),
    asyncHandler(menusController.patch),
  );
  
  router.delete(
    `${prefix}/:id`,
    authMiddleware,
    validate(menusSchema.patch), // we can reuse patch for params id validation
    asyncHandler(menusController.destroy),
  );
};
