import { type Router } from 'express';
import { validate } from '../../../utils/validate.js';
import {
  bulkDateSchema,
  singleDateSchema,
} from '../../../validations/intelligence/machine.validation.js';
import {
  predictBulkController,
  predictsController,
} from '../../../controllers/intelligence/predict.controller.js';

export default (router: Router) => {
  const prefix = '/predict';
  router.post(prefix, validate(singleDateSchema), predictsController);

  router.post(prefix + '/bulk', validate(bulkDateSchema), predictBulkController);
};
