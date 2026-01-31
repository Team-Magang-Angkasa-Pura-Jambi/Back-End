import { type Router } from 'express';
import { validate } from '../../../utils/validate.js';
import { singleDateSchema } from '../../../validations/intelligence/machine.validation.js';
import { classifyControllers } from '../../../controllers/intelligence/classify.controller.js';

export default (router: Router) => {
  const prefix = '/classify';
  router.post(
    prefix,
    validate(singleDateSchema), // Pakai schema yang sama karena inputnya sama
    classifyControllers,
  );
};
