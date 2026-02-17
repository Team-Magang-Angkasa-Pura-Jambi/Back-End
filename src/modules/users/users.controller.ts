import { type Request, type Response } from 'express';
import { res200 } from '../../utils/response.js';
import { usersService } from './users.service.js';

export const usersController = {
  store: async (req: Request, res: Response) => {
    const { body } = res.locals.validatedData;
    const data = await usersService.store(body);
    return res200({ res, message: 'Berhasil Menambahkan Data User', data });
  },

  show: async (req: Request, res: Response) => {
    const { query, params } = res.locals.validatedData;

    const userId = params?.id ? Number(params.id) : undefined;

    const data = await usersService.show(userId, query);
    return res200({ res, message: 'Berhasil Mendapatkan Data User', data });
  },

  patch: async (req: Request, res: Response) => {
    // 3. Ambil id dari validatedData saja biar konsisten dengan Zod
    const { params, body } = res.locals.validatedData;
    const data = await usersService.patch(Number(params.id), body);
    return res200({ res, message: 'Berhasil Mengubah Data User', data });
  },

  remove: async (req: Request, res: Response) => {
    // 4. Sama seperti patch, ambil dari validatedData.params
    const { params } = res.locals.validatedData;
    const data = await usersService.remove(Number(params.id));
    return res200({ res, message: 'Berhasil Menghapus Data User', data });
  },
};
