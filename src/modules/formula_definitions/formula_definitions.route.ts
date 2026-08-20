import { type Router } from 'express';
import { validate } from '../../utils/validate.js';
import { formulaController } from './formula_definitions.controller.js';
import { formulaSchema } from './formula_definitions.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const formulaRoute = (router: Router) => {
  const prefix = '/formula-definitions';

  router.get(prefix, validate(formulaSchema.show), asyncHandler(formulaController.show));

  router.get(`${prefix}/:id`, validate(formulaSchema.show), asyncHandler(formulaController.show));

  router.post(prefix, validate(formulaSchema.store), asyncHandler(formulaController.store));
  router.patch(
    `${prefix}/:id`,
    validate(formulaSchema.patch),
    asyncHandler(formulaController.update),
  );
  router.delete(
    `${prefix}/:id`,
    validate(formulaSchema.remove),
    asyncHandler(formulaController.remove),
  );
};
