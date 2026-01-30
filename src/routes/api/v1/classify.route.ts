import { type Router } from 'express';
import { validate } from '../../../utils/validate.js';
import { singleDateSchema } from '../../../validations/intelligence/machine.validation.js';
import {
  classifyOfficeController,
  classifyTerminalController,
} from '../../../controllers/intelligence/classify.controller.js';

export default (router: Router) => {
  const prefix = '/classify';
  router.post(
    prefix + '/terminal',
    validate(singleDateSchema), // Pakai schema yang sama karena inputnya sama
    classifyTerminalController,
  );

  router.post(prefix + '/office', validate(singleDateSchema), classifyOfficeController);
};
