import { type NextFunction, type Request, type Response } from 'express';
import { predictBulkRange, predictService } from '../../services/intelligence/predict.service.js';
import { res201 } from '../../utils/response.js';

export const predictsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, meterId } = res.locals.validatedData.body;

    const result = await predictService(new Date(date), Number(meterId));

    return res201({
      res,
      message: 'Prediksi  berhasil dibuat',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const predictBulkController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start_date, end_date, meterId } = res.locals.validatedData.body;

    const result = await predictBulkRange(
      new Date(start_date),
      new Date(end_date),
      Number(meterId),
    );

    return res201({
      res,
      message: `Berhasil memproses prediksi untuk ${result.processed_count} hari`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
