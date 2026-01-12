import { Router } from 'express';
import { weatherController } from '../../../controllers/weather.controller.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import { authMiddleware } from '../../../middleware/auth.middleware.js';
import { RoleName } from '../../../generated/prisma/index.js';

const router = Router();

// Semua rute di bawah ini memerlukan autentikasi
router.use(authMiddleware);

router.get(
  '/today',
  authorize(RoleName.Technician, RoleName.Admin, RoleName.SuperAdmin),
  asyncHandler(weatherController.getTodayWeather),
);

export default router;
