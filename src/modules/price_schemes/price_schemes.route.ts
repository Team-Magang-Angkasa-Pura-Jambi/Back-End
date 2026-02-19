import { type Router } from 'express';
import { priceSchemeController } from './price_schemes.controller.js';
import { validate } from '../../utils/validate.js';
import { priceSchemeSchema } from './price_schemes.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const priceSchemeRoute = (router: Router) => {
  const prefix = '/price-schemes';

  router.get(prefix, validate(priceSchemeSchema.show), asyncHandler(priceSchemeController.show));

  router.get(
    `${prefix}/:id`,
    validate(priceSchemeSchema.show),
    asyncHandler(priceSchemeController.show),
  );

  router.post(prefix, validate(priceSchemeSchema.store), asyncHandler(priceSchemeController.store));

  router.patch(
    `${prefix}/:id`,
    validate(priceSchemeSchema.patch),
    asyncHandler(priceSchemeController.update),
  );

  router.delete(
    `${prefix}/:id`,
    validate(priceSchemeSchema.remove),
    asyncHandler(priceSchemeController.remove),
  );
};
