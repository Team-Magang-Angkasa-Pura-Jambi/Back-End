import { Request, Response, NextFunction } from 'express';
import { res200 } from '../../utils/response.js';
import { evaluationService } from './evalution.service.js';

export const evaluationController = {
  run: async (req: Request, res: Response, next: NextFunction) => {
    const bodyData = res.locals.validatedData?.body || req.body;

    const { meter_id, summary_id, ...payloadData } = bodyData;

    if (!meter_id || !summary_id) {
      return res.status(400).json({
        status: 'error',
        message: 'meter_id dan summary_id wajib dikirim!',
      });
    }

    const data = await evaluationService.run(payloadData, meter_id, summary_id);

    if (!data) {
      return res200({
        res,
        message: 'Meteran ini tidak menggunakan AI (di-skip).',
        data: null,
      });
    }

    return res200({
      res,
      message: 'Evaluasi Machine Learning berhasil dijalankan dan disimpan!',
      data,
    });
  },
};
