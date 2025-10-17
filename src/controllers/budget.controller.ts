import { type Request, type Response } from 'express';
import { budgetService } from '../services/budget.service.js';
import { controllerPaginationHelper } from '../utils/controllerHelper.js';

export class BudgetController {
  async processBudget(req: Request, res: Response) {
    const { pjj_rate, process_date } = req.body;

    const result = await budgetService.processAnnualBudgetAndSetTargets(
      Number(pjj_rate),
      process_date ? new Date(process_date) : undefined
    );

    res.status(200).json({
      status: {
        code: 200,
        message: 'Proses anggaran berhasil dijalankan.',
      },
      data: result,
    });
  }
}

export const budgetController = new BudgetController();
