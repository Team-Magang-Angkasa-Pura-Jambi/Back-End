import { type Request, type Response } from 'express';
import {
  annualBudgetService,
  AnnualBudgetService,
} from '../../services/finance/annualBudget.service.js';
import type {
  CreateAnnualBudgetBody,
  GetAnnualBudgetQuery,
  UpdateAnnualBudgetBody,
} from '../../types/finance/annualBudget.types.js';
import { BaseController } from '../../utils/baseController.js';
import { AnnualBudget, Prisma } from '../../generated/prisma/index.js';
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

  /**
   * Mengambil semua anggaran dengan data detail (alokasi bulanan dan per meter).
   * Metode ini secara internal memanggil `getDetailedBudgets` dari service.
   * Mendukung filter berdasarkan tanggal aktif melalui query parameter `date`.
   */
  public override getAll = async (req: Request, res: Response) => {
    // PERBAIKAN: Validasi dan type-safety yang lebih baik
    const query = res.locals.validatedData?.query as
      | GetAnnualBudgetQuery
      | undefined;
    const date = query?.date;

    const where: Prisma.AnnualBudgetWhereInput = {};
    if (date) {
      const targetDate = new Date(date);
      where.period_start = { lte: targetDate };
      where.period_end = { gte: targetDate };
    }

    const budgets = await annualBudgetService.getDetailedBudgets({ where });
    res200({
      res,
      message: 'Successfully retrieved annual budgets',
      data: budgets,
    });
  };

  /**
   * BARU: Mengambil semua anggaran INDUK (tahunan) dengan data detail.
   */
  public getAllParents = async (req: Request, res: Response) => {
    const query = res.locals.validatedData?.query as
      | GetAnnualBudgetQuery
      | undefined;
    const date = query?.date;

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
    const params = res.locals.validatedData?.params as
      | { budgetId: number }
      | undefined;
    const budgetId = params?.budgetId ?? 0;

    const detailedBudget =
      await annualBudgetService.getDetailedBudgetById(budgetId);
    res200({
      res,
      message: 'Successfully retrieved detailed annual budget',
      data: detailedBudget,
    });
  };
}

export const annualBudgetController = new AnnualBudgetController();
