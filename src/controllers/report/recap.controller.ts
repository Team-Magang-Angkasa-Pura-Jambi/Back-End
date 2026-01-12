import type { Request, Response, NextFunction } from 'express';
import { Error401 } from '../../utils/customError.js';
import { res200 } from '../../utils/response.js';
import { recapService } from '../../services/reports/recap.service.js';

class RecapController {
  public getRecap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedData.query;
      const result = await recapService.getRecap(query);
      const { data, meta } = result;

      res200({ res, data, meta, message: 'Rekap berhasil diambil.' });
    } catch (error) {
      next(error);
    }
  };

  public recalculateRecap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        throw new Error401('Data pengguna tidak ditemukan. Sesi mungkin tidak valid.');
      }
      const { startDate, endDate, meterId } = res.locals.validatedData.body;

      await recapService.recalculateSummaries(
        new Date(startDate),
        new Date(endDate),
        meterId,
        Number(user.id),
      );

      res200({
        res,
        message: 'Proses kalkulasi ulang telah dimulai di latar belakang.',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const recapController = new RecapController();
