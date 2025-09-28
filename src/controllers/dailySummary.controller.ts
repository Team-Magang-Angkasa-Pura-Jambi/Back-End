import type { Request, Response } from 'express';
import type { DailySummary } from '../generated/prisma/index.js';
import {
  dailySummaryService,
  DailySummaryService,
} from '../services/dailySummary.service.js';
import type {
  CreateSummaryBody,
  SummaryParams,
  UpdateSummaryBody,
} from '../types/dailySummary.type.js';
import { BaseController } from '../utils/baseController.js';
import { getMonthlyReportSchema } from '../validations/dailySummary.validation.js';
import { res200 } from '../utils/response.js';

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
    // 1. Validasi query parameter menggunakan skema Zod

    const { query } = res.locals.validatedData;

    // 2. Panggil service method dengan data yang sudah divalidasi
    const report = await dailySummaryService.getMonthlySummaryReport(
      query.year,
      query.month
    );

    

    // 3. Kirim respon sukses
    res200({
      res,
      message: 'Event Logbook berhasil dibuat.',
      data: report,
    });
  };
}

export const dailySummaryController = new DailySummaryController();
