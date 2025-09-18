import type { Request, Response } from 'express';
import type { SummaryService } from '../services/summary.service.js';
import type { GetSummaryQuery } from '../types/summary.type.js';
import { res200 } from '../utils/response.js';

/**
 * Controller untuk menangani request HTTP terkait Summary Dasbor.
 */
export class SummaryController {
  constructor(private summaryService: SummaryService) {}

  public getSummary = async (
    req: Request<{}, {}, {}, GetSummaryQuery>,
    res: Response
  ) => {
    const summaryData = await this.summaryService.getDashboardSummary(
      req.query
    );
    res200({
      res,
      message: 'Berhasil mengambil data ringkasan.',
      data: summaryData,
    });
  };
}
