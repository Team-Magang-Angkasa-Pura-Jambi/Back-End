import { Router } from 'express';
import { machineLearningController } from '../../../controllers/intelligence/machineLearning.controller.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../utils/validate.js';
import { z } from 'zod';

export default (router: Router) => {
  const prefix = '/analysis';

  // Endpoint untuk menjalankan prediksi
  router.post(
    `${prefix}/run-prediction`,
    authorize('Admin', 'SuperAdmin'),
    validate(z.object({ body: z.object({ date: z.string().date() }) })),
    asyncHandler(machineLearningController.runPrediction)
  );
};
