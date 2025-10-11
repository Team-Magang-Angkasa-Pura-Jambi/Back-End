import { Router } from 'express';
import { z } from 'zod';
import {
  authMiddleware,
  authorize,
} from '../../../middleware/auth.middleware.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { analysisController } from '../../../controllers/analysis.controller.js';

// Skema validasi untuk query analisis
const analysisQuerySchema = z.object({
  query: z.object({
    energyType: z.enum(['Electricity', 'Water', 'Fuel']),
    // Format YYYY-MM, contoh: "2024-05"
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM'),
    meterId: z.coerce.number().int().positive().optional(),
  }),
});

// Skema validasi untuk ringkasan hari ini
const todaySummaryQuerySchema = z.object({
  query: z.object({
    energyType: z.enum(['Electricity', 'Water', 'Fuel']).optional(),
  }),
});

export default (router: Router) => {
  const prefix = '/analysis';

  // Semua rute di bawah ini memerlukan autentikasi
  router.use(prefix, authMiddleware);

  // GET /api/v1/analysis
  // Endpoint untuk data time-series bulanan (konsumsi, prediksi, target)
  router.get(
    prefix,
    authorize('Admin', 'SuperAdmin'),
    validate(analysisQuerySchema),
    asyncHandler(analysisController.getMonthlyAnalysis)
  );

  // GET /api/v1/analysis/classification-summary
  // Endpoint BARU untuk ringkasan jumlah klasifikasi
  router.get(
    `${prefix}/classification-summary`,
    authorize('Admin', 'SuperAdmin'),
    validate(analysisQuerySchema),
    asyncHandler(analysisController.getClassificationSummary)
  );

  // GET /api/v1/analysis/today-summary
  // Endpoint BARU untuk ringkasan konsumsi hari ini
  router.get(
    `${prefix}/today-summary`,
    authorize('Technician', 'Admin', 'SuperAdmin'), // Bisa diakses semua role
    validate(todaySummaryQuerySchema),
    asyncHandler(analysisController.getTodaySummary)
  );
};
