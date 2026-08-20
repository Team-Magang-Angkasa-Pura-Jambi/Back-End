import { Request, Response, NextFunction } from 'express';
import { res200, res201 } from '../../utils/response.js';
import { predictionsService } from './predictions.service.js';

export const predictionsController = {
  predictSingle: async (req: Request, res: Response, next: NextFunction) => {
    const payload = res.locals.validatedData?.body || req.body;
    const result = await predictionsService.predictSingle(payload);

    return res200({
      res,
      message: 'Prediksi Machine Learning berhasil dihitung dan disimpan!',
      data: result,
    });
  },

  predictBulk: async (req: Request, res: Response, next: NextFunction) => {
    const payload = res.locals.validatedData?.body || req.body;
    const result = await predictionsService.predictBulk(payload);

    return res200({
      res,
      message: 'Prediksi rentang tanggal Machine Learning berhasil dihitung dan disimpan!',
      data: result,
    });
  },

  getPredictions: async (req: Request, res: Response, next: NextFunction) => {
    const query = (res.locals.validatedData?.query || req.query) as any;
    const result = await predictionsService.getPredictions(query);

    return res200({
      res,
      message: 'Data prediksi berhasil diambil!',
      data: result.data,
      meta: result.meta,
    });
  },
};
