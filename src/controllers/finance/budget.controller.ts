import { type NextFunction, type Request, type Response } from 'express';
import { budgetService } from '../../services/finance/budget.service.js';
import { res200 } from '../../utils/response.js';

export class BudgetController {
  public getBudgetPreview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const budgetData = res.locals.validatedData.body;
      const result = await budgetService.getBudgetAllocationPreview(budgetData);
      res200({
        res,
        data: result,
        message: `Pratinjau alokasi anggaran berhasil dihitung.`,
      });
    } catch (error) {
      next(error);
    }
  };

  public getBudgetSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedData?.query;

      const targetYear = query?.year ?? new Date().getFullYear();

      const result = await budgetService.getBudgetSummary(targetYear);

      res200({
        res,
        data: result,
        message: `Ringkasan anggaran tahun ${targetYear} per jenis energi berhasil diambil.`,
      });
    } catch (error) {
      next(error);
    }
  };

  public prepareNextPeriodBudget = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { parentBudgetId } = res.locals.validatedData.params;
      const result = await budgetService.prepareNextPeriodBudget(parentBudgetId);
      res200({
        res,
        data: result,
        message: `Data persiapan untuk anggaran periode berikutnya berhasil diambil.`,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const budgetController = new BudgetController();
