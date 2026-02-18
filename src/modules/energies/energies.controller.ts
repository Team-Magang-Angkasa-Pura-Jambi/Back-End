// Generated for Sentinel Project

import { type NextFunction, type Request, type Response } from 'express';
import { energiesService } from './energies.service.js';
import { res200 } from '../../utils/response.js';
import { Error404 } from '../../utils/customError.js';

export const energiesController = {
  store: async (req: Request, res: Response, next: NextFunction) => {
    const { body } = res.locals.validatedData;
    const data = await energiesService.store(body);
    return res200({ res, message: 'Berhasil Menambahkan Data', data });
  },
  show: async (req: Request, res: Response, next: NextFunction) => {
    const { query, params } = res.locals.validatedData;

    if (!params) throw new Error404('ID harus diisi');
    const id = params?.id ? Number(params.id) : undefined;

    const data = await energiesService.show(id);
    return res200({ res, message: 'Berhasil Mendapatkan Data', data });
  },
  patch: async (req: Request, res: Response, next: NextFunction) => {
    const { body, params } = res.locals.validatedData;
    const data = await energiesService.patch(Number(params.id), body);
    return res200({ res, message: 'Berhasil Mengubah Data', data });
  },
  remove: async (req: Request, res: Response, next: NextFunction) => {
    const { params } = res.locals.validatedData;

    if (!params) {
      throw new Error404('ID harus diisi');
    }

    const data = await energiesService.remove(Number(params.id));
    return res200({ res, message: 'Berhasil Menghapus Data', data });
  },
};
