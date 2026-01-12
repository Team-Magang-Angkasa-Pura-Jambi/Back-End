import { type Request, type Response } from 'express';
import {
  annualBudgetService,
  type AnnualBudgetService,
} from '../../services/finance/annualBudget.service.js';
import type {
  CreateAnnualBudgetBody,
  GetAnnualBudgetQuery,
  UpdateAnnualBudgetBody,
} from '../../types/finance/annualBudget.types.js';
import { BaseController } from '../../utils/baseController.js';
import { type AnnualBudget, type Prisma } from '../../generated/prisma/index.js';
import { res200 } from '../../utils/response.js';

export class AnnualBudgetController extends BaseController<
  AnnualBudget,
  CreateAnnualBudgetBody,
  UpdateAnnualBudgetBody,
  GetAnnualBudgetQuery,
  AnnualBudgetService
> {
  constructor() {
    super(annualBudgetService, 'budgetId');
  }

  public getYearsOptions = async (req: Request, res: Response) => {
    const years = await annualBudgetService.getAvailableYears();
    res200({
      res,
      message: 'Successfully retrieved available years',
      data: years,
    });
  };

  /**
   * BARU: Mengambil semua anggaran dengan data detail.
   */

  public override getAll = async (req: Request, res: Response) => {
    const query = res.locals.validatedData?.query as GetAnnualBudgetQuery | undefined;

    const targetYear = query?.year ?? new Date().getFullYear();
    const targetEnergyType = query?.energy_type;

    const startDate = new Date(Date.UTC(targetYear, 0, 1));
    const endDate = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59));

    const where: Prisma.AnnualBudgetWhereInput = {
      period_start: {
        gte: startDate,
        lte: endDate,
      },

      ...(targetEnergyType && {
        energy_type: {
          type_name: targetEnergyType,
        },
      }),
    };

    const budgets = await annualBudgetService.getDetailedBudgets({
      where,
      orderBy: { period_start: 'asc' }, // Opsional: urutkan berdasarkan bulan
    });

    res200({
      res,
      message: `Successfully retrieved annual budgets for year ${targetYear}`,
      data: budgets,
    });
  };

  /**
   * BARU: Mengambil semua anggaran INDUK (tahunan) dengan data detail.
   */
  public getAllParents = async (req: Request, res: Response) => {
    const query = res.locals.validatedData?.query as GetAnnualBudgetQuery | undefined;
    const date = query?.year;

    const where: Prisma.AnnualBudgetWhereInput = {};
    if (date) {
      const targetDate = new Date(date);
      where.period_start = { lte: targetDate };
      where.period_end = { gte: targetDate };
    }

    const parentBudgets = await annualBudgetService.getParentBudgets({
      where,
    });
    res200({
      res,
      message: 'Successfully retrieved parent annual budgets',
      data: parentBudgets,
    });
  };

  /**
   * Mengambil satu anggaran berdasarkan ID dengan data yang sangat detail.
   */
  public override getById = async (req: Request, res: Response) => {
    // PERBAIKAN: Validasi dan type-safety yang lebih baik
    const params = res.locals.validatedData?.params as { budgetId: number } | undefined;
    const budgetId = params?.budgetId ?? 0;

    const detailedBudget = await annualBudgetService.getDetailedBudgetById(budgetId);
    res200({
      res,
      message: 'Successfully retrieved detailed annual budget',
      data: detailedBudget,
    });
  };
}

export const annualBudgetController = new AnnualBudgetController();
