import { type Request, type Response } from 'express';
import { res200, res201 } from '../../utils/response.js';
import { readingService } from './reading_sessions.service.js';

export const readingController = {
  store: async (req: Request, res: Response) => {
    const { body } = res.locals.validatedData;

    const userId = Number(req.user?.id);

    if (!userId) throw new Error('User tidak ditemukan');

    const data = await readingService.store(body, userId);
    return res201({
      res,
      message: 'Pembacaan berhasil disimpan. Sistem sedang mengkalkulasi output...',
      data,
    });
  },

  show: async (req: Request, res: Response) => {
    const { query } = res.locals.validatedData;
    const result = await readingService.show(query);
    return res200({
      res,
      message: 'Daftar pembacaan berhasil diambil',
      data: result.data,
      meta: result.meta,
    });
  },

  remove: async (req: Request, res: Response) => {
    const { params } = res.locals.validatedData;

    if (!params) throw new Error('ID tidak ditemukan');

    await readingService.remove(params.id);
    return res200({ res, message: 'Data pembacaan berhasil dihapus' });
  },
};
