import { Router } from 'express';
import { analysisController } from '../../../controllers/analysis.controller.js';

import { getAnalysisSchema } from '../../../validations/analysis.validation.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { validate } from '../../../utils/validate.js';

export default (router: Router) => {
  const prefix = '/analysis';
  router.get(
    prefix,
    validate(getAnalysisSchema),
    asyncHandler(analysisController.getAnalysis)
  );
};
