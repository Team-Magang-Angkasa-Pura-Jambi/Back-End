import { type Router } from 'express';
import { paxController } from './pax.controller.js';
import { validate } from '../../utils/validate.js';
import { paxSchema } from './pax.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const paxRouter = (router: Router) => {
  const prefix = '/pax';

  router.get(prefix, validate(paxSchema.show), asyncHandler(paxController.show));

  router.get(`${prefix}/:id`, validate(paxSchema.detail), asyncHandler(paxController.getById));

  router.post(prefix, validate(paxSchema.store), asyncHandler(paxController.store));

  router.patch(`${prefix}/:id`, validate(paxSchema.update), asyncHandler(paxController.update));

  router.delete(
    `${prefix}/:id`,
    validate(paxSchema.detail), // Menggunakan validasi params id yang sama
    asyncHandler(paxController.remove),
  );
};
