import { type Router } from 'express';
import { validate } from '../../utils/validate.js';
import { templateSchema } from './calculation_templates.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { templateController } from './calculation_templates.controller.js';

export const templateRoute = (router: Router) => {
  const prefix = '/calculation-templates';

  router.get(prefix, validate(templateSchema.show), asyncHandler(templateController.show));

  router.get(`${prefix}/:id`, validate(templateSchema.show), asyncHandler(templateController.show));

  router.post(prefix, validate(templateSchema.store), asyncHandler(templateController.store));

  router.patch(
    `${prefix}/:id`,
    validate(templateSchema.patch),
    asyncHandler(templateController.update),
  );

  router.delete(
    `${prefix}/:id`,
    validate(templateSchema.remove),
    asyncHandler(templateController.remove),
  );
};
