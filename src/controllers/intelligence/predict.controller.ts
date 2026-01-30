import { type NextFunction, type Request, type Response } from 'express';
import {
  predictTerminal,
  predictOffice,
  predictBulkRange,
} from '../../services/intelligence/predict.service.js';
import { res201 } from '../../utils/response.js';

export const predictTerminalController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { date, meter_id } = res.locals.validatedData.body;

    const result = await predictTerminal(new Date(date), Number(meter_id));

    return res201({
      res,
      message: 'Prediksi Terminal berhasil dibuat',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const predictOfficeController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, meter_id } = res.locals.validatedData.body;

    const result = await predictOffice(new Date(date), Number(meter_id));

    return res201({
      res,
      message: 'Prediksi Kantor berhasil dibuat',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const predictBulkController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start_date, end_date, meter_id } = res.locals.validatedData.body;

    const result = await predictBulkRange(
      new Date(start_date),
      new Date(end_date),
      Number(meter_id),
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
