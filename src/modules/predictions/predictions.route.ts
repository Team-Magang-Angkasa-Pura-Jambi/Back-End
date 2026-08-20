import { type Router } from 'express';
import { validate } from '../../utils/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  singlePredictionSchema,
  bulkPredictionSchema,
  queryPredictionSchema,
} from './predictions.schema.js';
import { predictionsController } from './predictions.controller.js';

export const predictionRoute = (router: Router) => {
  // Routes for FE compatibility (/predict and /predict/bulk)
  router.post(
    '/predict',
    validate(singlePredictionSchema),
    asyncHandler(predictionsController.predictSingle),
  );

  router.post(
    '/predict/bulk',
    validate(bulkPredictionSchema),
    asyncHandler(predictionsController.predictBulk),
  );

  // RESTful routes under /predictions
  router.post(
    '/predictions/run',
    validate(singlePredictionSchema),
    asyncHandler(predictionsController.predictSingle),
  );

  router.post(
    '/predictions/bulk',
    validate(bulkPredictionSchema),
    asyncHandler(predictionsController.predictBulk),
  );

  router.get(
    '/predictions',
    validate(queryPredictionSchema),
    asyncHandler(predictionsController.getPredictions),
  );
};
