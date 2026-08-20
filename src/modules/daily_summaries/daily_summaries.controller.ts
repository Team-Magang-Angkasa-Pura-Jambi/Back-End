import { type Request, type Response } from 'express';
import { dailySummaryService } from './daily_summaries.service.js';
import { res200 } from '../../utils/response.js';

export const dailySummaryController = {
  show: async (req: Request, res: Response) => {
    const { query } = res.locals.validatedData;

    const result = await dailySummaryService.show(query);

    return res200({
      res,
      message: 'Daftar summary berhasil diambil',
      data: result?.data,
      meta: result?.meta,
    });
  },

  getRecapData: async (req: Request, res: Response) => {
    const { query } = res.locals.validatedData;

    // Asumsi fungsi getRecapData sudah ada di dalam dailySummaryService
    const result = await dailySummaryService.getRecapData(query);

    return res200({
      res,
      message: 'Daftar rekapitulasi berhasil diambil',
      data: result?.data,
      meta: result?.meta,
    });
  },
};
