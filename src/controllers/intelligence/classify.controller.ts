import { type Request, type Response, type NextFunction } from 'express';

import { res200 } from '../../utils/response.js';
import { classifyService } from '../../services/intelligence/classify.service.js';

export const classifyControllers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, meterId } = res.locals.validatedData.body;

    const result = await classifyService(new Date(date), Number(meterId));

    return res200({
      res,
      message: 'Klasifikasi performa  berhasil',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
