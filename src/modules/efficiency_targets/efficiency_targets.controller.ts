// Generated for Sentinel Project

import { type NextFunction, type Request, type Response } from 'express';
import { efficiencyTargetsService } from './efficiency_targets.service.js';
import { res200, res201 } from '../../utils/response.js';
import { Error404 } from '../../utils/customError.js';

export const efficiencyController = {
  store: async (req: Request, res: Response, next: NextFunction) => {
    const { body } = res.locals.validatedData;

    const data = await efficiencyTargetsService.store(body);

    return res201({ res, message: 'Data Ditambahkan!', data });
  },
  show: async (req: Request, res: Response, next: NextFunction) => {
    const { params, query } = res.locals.validatedData;

    const data = await efficiencyTargetsService.show(Number(params.id), query);

    return res200({ res, message: 'Data Ditemukan!', data });
  },

  patch: async (req: Request, res: Response, next: NextFunction) => {
    const { params, body } = res.locals.validatedData;

    if (!params) throw new Error404('ID tidak ditemukan');

    const data = await efficiencyTargetsService.patch(Number(params.id), body);

    return res201({ res, message: 'Data Diperbarui!', data });
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    const { params } = res.locals.validatedData;

    if (!params) throw new Error404('ID tidak ditemukan');

    const data = await efficiencyTargetsService.remove(Number(params.id));

    return res201({ res, message: 'Data Dihapus!', data });
  },

  previewEfficiency: async (req: Request, res: Response, next: NextFunction) => {
    const { body } = res.locals.validatedData;
    const data = await efficiencyTargetsService.previewEfficiency(body);
    return res200({ res, message: 'Data Diperbarui!', data });
  },
};
