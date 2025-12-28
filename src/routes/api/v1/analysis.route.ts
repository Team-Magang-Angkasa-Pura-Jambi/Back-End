import { Router } from 'express';
import { z } from 'zod';
import {
  authMiddleware,
  authorize,
} from '../../../middleware/auth.middleware.js';
import { validate } from '../../../utils/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { analysisController } from '../../../controllers/report/analysis.controller.js';
import { bulkPredictionSchema } from '../../../validations/reports/analysis.validation.js';
import { recapController } from '../../../controllers/report/recap.controller.js';

const analysisQuerySchema = z.object({
  query: z.object({
    energyType: z.enum(['Electricity', 'Water', 'Fuel']),

    month: z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM'),
    meterId: z.coerce.number().int().positive().optional(),
  }),
});

// BARU: Skema validasi untuk prediksi tunggal
const singlePredictionSchema = z.object({
  body: z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    meterId: z.coerce
      .number()
      .int()
      .positive('meterId harus berupa angka positif'),
  }),
});

const classificationSummaryQuerySchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM'),
  }),
});

// BARU: Skema validasi untuk analisis stok BBM
const fuelStockAnalysisQuerySchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM'),
  }),
});

const todaySummaryQuerySchema = z.object({
  query: z.object({
    energyType: z.enum(['Electricity', 'Water', 'Fuel']).optional(),
  }),
});

// BARU: Skema validasi untuk alokasi anggaran
const budgetAllocationQuerySchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(2100),
  }),
});

// BARU: Skema validasi untuk pratinjau anggaran
const budgetPreviewSchema = z.object({
  body: z.object({
    // PERBAIKAN: Input sekarang adalah ID anggaran induk, bukan total budget mentah.
    parent_budget_id: z.coerce.number().int().positive(),
    period_start: z.coerce.date(),
    period_end: z.coerce.date(),
    // BARU: Terima data alokasi untuk pratinjau per meter
    allocations: z
      .array(
        z.object({
          meter_id: z.coerce.number().int().positive(),
          weight: z.coerce.number().min(0).max(1),
        })
      )
      .optional(),
  }),
});

// BARU: Skema validasi untuk pratinjau target efisiensi
const efficiencyTargetPreviewSchema = z.object({
  body: z.object({
    target_value: z.coerce
      .number()
      .positive('Target value must be greater than 0'),
    meter_id: z.coerce.number().int().positive('Invalid Meter ID'),
    period_start: z.coerce.date({
      errorMap: () => ({ message: 'Format tanggal mulai tidak valid' }),
    }),
    period_end: z.coerce.date({
      errorMap: () => ({ message: 'Format tanggal akhir tidak valid' }),
    }),
  }),
});

// BARU: Skema validasi untuk persiapan anggaran periode berikutnya
const prepareBudgetSchema = z.object({
  params: z.object({
    parentBudgetId: z.coerce
      .number()
      .int()
      .positive('ID Anggaran Induk tidak valid'),
  }),
});

// BARU: Skema validasi untuk rekap bulanan
const monthlyRecapSchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    energyType: z.enum(['Electricity', 'Water', 'Fuel']),
    meterId: z.coerce.number().int().positive().optional(),
  }),
});

export default (router: Router) => {
  const prefix = '/analysis';

  router.use(prefix, authMiddleware);

  router.get(
    prefix,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(analysisQuerySchema),
    asyncHandler(analysisController.getMonthlyAnalysis)
  );

  router.get(
    `${prefix}/fuel-stock`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(fuelStockAnalysisQuerySchema),
    asyncHandler(analysisController.getMonthlyFuelStockAnalysis)
  );

  router.get(
    `${prefix}/classification-summary`,
    authorize('Admin', 'SuperAdmin', 'Technician'),
    validate(classificationSummaryQuerySchema),
    asyncHandler(analysisController.getClassificationSummary)
  );

  router.get(
    `${prefix}/budget-allocation`,
    authorize('Admin', 'SuperAdmin'),
    validate(budgetAllocationQuerySchema),
    asyncHandler(analysisController.getBudgetAllocation)
  );

  router.post(
    `${prefix}/budget-preview`,
    authorize('Admin', 'SuperAdmin'),
    validate(budgetPreviewSchema),
    asyncHandler(analysisController.getBudgetPreview) // PERBAIKAN: Menggunakan POST
  );

  router.get(
    `${prefix}/budget-summary`,
    authorize('Admin', 'SuperAdmin'),
    // Tidak perlu validasi karena tidak ada input
    asyncHandler(analysisController.getBudgetSummary)
  );

  router.get(
    `${prefix}/today-summary`,
    authorize('Technician', 'Admin', 'SuperAdmin'),
    validate(todaySummaryQuerySchema),
    asyncHandler(analysisController.getTodaySummary)
  );

  router.post(
    `${prefix}/run-single-prediction`,
    authorize('SuperAdmin', 'Admin', 'Technician'),
    validate(singlePredictionSchema),
    asyncHandler(analysisController.runSinglePrediction)
  );

  router.post(
    `${prefix}/run-bulk-predictions`,
    authorize('SuperAdmin'),
    validate(bulkPredictionSchema),
    asyncHandler(analysisController.runBulkPredictions)
  );

  // BARU: Endpoint untuk menjalankan klasifikasi untuk satu meter pada satu hari
  router.post(
    `${prefix}/run-single-classification`,
    authorize('Admin', 'SuperAdmin'),
    validate(singlePredictionSchema), // Menggunakan skema yang sama dengan prediksi tunggal
    asyncHandler(analysisController.runSingleClassification)
  );

  // BARU: Endpoint untuk mendapatkan pratinjau target efisiensi dari anggaran
  router.post(
    `${prefix}/efficiency-target-preview`,
    authorize('Admin', 'SuperAdmin'),
    validate(efficiencyTargetPreviewSchema),
    asyncHandler(analysisController.getEfficiencyTargetPreview)
  );

  // BARU: Endpoint untuk mendapatkan sisa anggaran yang bisa dialokasikan
  router.get(
    `${prefix}/prepare-budget/:parentBudgetId`,
    authorize('Admin', 'SuperAdmin'),
    validate(prepareBudgetSchema),
    asyncHandler(analysisController.prepareNextPeriodBudget)
  );

  // BARU: Endpoint untuk mendapatkan rekap bulanan agregat
  router.get(
    `${prefix}/monthly-recap`,
    authorize('Admin', 'SuperAdmin'),
    validate(monthlyRecapSchema),
    asyncHandler(recapController.getMonthlyRecap)
  );
};
