import { type NextFunction, type Request, type Response } from 'express';
import { res200 } from '../../utils/response.js';
import { readingTypesSerices } from './reading-types.service.js';
import { Error404 } from '../../utils/customError.js';

// Generated for Sentinel Project
export const readingTypesController = {
  store: async (req: Request, res: Response, next: NextFunction) => {
    const { body } = res.locals.validatedData;
    const data = await readingTypesSerices.create(body);
    return res200({ res, message: 'Berhasil Menambahkan Data', data });
  },
  show: async (req: Request, res: Response, next: NextFunction) => {
    const { query, params } = res.locals.validatedData;

    const id = params?.id ? Number(params.id) : undefined;

    const data = await readingTypesSerices.show(id, query);

    return res200({ res, message: 'Berhasil Mendapatkan Data', data });
  },
  patch: async (req: Request, res: Response, next: NextFunction) => {
    const { body, params } = res.locals.validatedData;
    if (!params) throw new Error404('ID harus diisi');

    const data = await readingTypesSerices.patch(Number(params.id), body);

    return res200({ res, message: 'Berhasil Mengubah Data', data });
  },
  remove: async (req: Request, res: Response, next: NextFunction) => {
    const { params } = res.locals.validatedData;
    if (!params) throw new Error404('ID harus diisi');

    const data = await readingTypesSerices.remove(Number(params.id));
    return res200({ res, message: 'Berhasil Menghapus Data', data });
  },
};
