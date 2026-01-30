import { type Request, type Response, type NextFunction } from 'express';

import { classifyTerminal, classifyOffice } from '../../services/intelligence/classify.service.js';
import { res200 } from '../../utils/response.js';

export const classifyTerminalController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { date, meter_id } = res.locals.validatedData.body;

    const result = await classifyTerminal(new Date(date), Number(meter_id));

    return res200({
      res,
      message: 'Klasifikasi performa Terminal berhasil',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const classifyOfficeController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, meter_id } = res.locals.validatedData.body;

    const result = await classifyOffice(new Date(date), Number(meter_id));

    return res200({
      res,
      message: 'Klasifikasi performa Kantor berhasil',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
