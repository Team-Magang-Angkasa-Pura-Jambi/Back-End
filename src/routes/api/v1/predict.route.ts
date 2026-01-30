import { type Router } from 'express';
import { validate } from '../../../utils/validate.js';
import {
  bulkDateSchema,
  singleDateSchema,
} from '../../../validations/intelligence/machine.validation.js';
import {
  predictBulkController,
  predictOfficeController,
  predictTerminalController,
} from '../../../controllers/intelligence/predict.controller.js';

export default (router: Router) => {
  const prefix = '/predict';
  router.post(prefix + '/terminal', validate(singleDateSchema), predictTerminalController);

  router.post(prefix + '/office', validate(singleDateSchema), predictOfficeController);

  router.post(prefix + '/bulk', validate(bulkDateSchema), predictBulkController);
};
