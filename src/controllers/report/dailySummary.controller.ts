import type { Request, Response } from 'express';
import type { DailySummary } from '../../generated/prisma/index.js';
import {
  dailySummaryService,
  DailySummaryService,
} from '../../services/reports/dailySummary.service.js';
import type {
  CreateSummaryBody,
  SummaryParams,
  UpdateSummaryBody,
} from '../../types/dailySummary.type.js';
import { BaseController } from '../../utils/baseController.js';
import { res200 } from '../../utils/response.js';

export class DailySummaryController extends BaseController<
  DailySummary,
  CreateSummaryBody,
  UpdateSummaryBody,
  SummaryParams,
  DailySummaryService
> {
  constructor() {
    super(new DailySummaryService(), 'summaryId');
  }

  static getMonthlyReport = async (req: Request, res: Response) => {
    const { query } = res.locals.validatedData;

    const report = await dailySummaryService.getMonthlySummaryReport(
      query.year,
      query.month
    );

    res200({
      res,
      message: 'Event Logbook berhasil dibuat.',
      data: report,
    });
  };
}

export const dailySummaryController = new DailySummaryController();
