import { type Request, type Response } from 'express';
import { dailySummaryService } from './daily_summaries.service.js';
import { res200 } from '../../utils/response.js';

export const dailySummaryController = {
  show: async (req: Request, res: Response) => {
    const { query } = res.locals.validatedData;

    const data = await dailySummaryService.show(query);

    return res200({ res, message: 'Daftar summary berhasil diambil', data });
  },
};
