import { type Router } from 'express';
import { validate } from '../../utils/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runEvaluationSchema } from './evalution.schema.js';
import { evaluationController } from './evalution.controller.js';

export const evaluationRouter = (router: Router) => {
  const prefix = '/evaluations';

  router.post(
    prefix + '/run',
    validate(runEvaluationSchema),
    asyncHandler(evaluationController.run),
  );
};
