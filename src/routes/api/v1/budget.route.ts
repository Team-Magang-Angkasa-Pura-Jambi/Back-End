import { Router } from 'express';
import { budgetController } from '../../../controllers/finance/budget.controller.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { authorize } from '../../../middleware/auth.middleware.js';
import { z } from 'zod';
import { validate } from '../../../utils/validate.js';

// BARU: Skema validasi untuk body request
const processBudgetSchema = z.object({
  body: z.object({
    pjj_rate: z.coerce.number().min(0).max(1),
    process_date: z.string().date('Format tanggal tidak valid.').optional(),
  }),
});

export default (router: Router) => {
  // PERBAIKAN: Ubah nama rute agar lebih deskriptif
  router.post(
    '/budget/process',
    authorize('SuperAdmin', 'Admin'),
    validate(processBudgetSchema),
    asyncHandler(budgetController.processBudget)
  );
};
