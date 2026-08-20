import { type Request, type Response } from 'express';
import { priceSchemeService } from './price_schemes.service.js';
import { res200, res201 } from '../../utils/response.js';
import { Error404 } from '../../utils/customError.js';

export const priceSchemeController = {
  store: async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new Error404('User tidak ditemukan');

    const { body } = res.locals.validatedData;

    body.scheme.created_by = Number(userId);

    const data = await priceSchemeService.store(body);
    return res201({ res, message: 'Skema harga berhasil dibuat', data });
  },

  show: async (req: Request, res: Response) => {
    const { params, query } = res.locals.validatedData;

    if (params?.id) {
      const result = await priceSchemeService.show(params.id);
      if (!result) throw new Error404('Skema harga tidak ditemukan');
      return res200({ res, message: 'Detail Skema Harga', data: result });
    }

    const result = await priceSchemeService.show(undefined, query);
    const listResult = result as unknown as { data: any[]; meta: any };

    return res200({
      res,
      message: 'Daftar Skema Harga',
      data: listResult.data,
      meta: listResult.meta,
    });
  },

  update: async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { params, body } = res.locals.validatedData;
    if (!params) throw new Error404('ID tidak ditemukan');
    const { id } = params;

    const existing = await priceSchemeService.show(id);
    if (!existing) throw new Error404('Skema harga tidak ditemukan');

    if (userId) body.scheme.updated_by = Number(userId);

    const data = await priceSchemeService.patch(id, body);
    return res200({ res, message: 'Skema harga berhasil diperbarui', data });
  },

  remove: async (req: Request, res: Response) => {
    const { params } = res.locals.validatedData;
    if (!params) throw new Error404('ID tidak ditemukan');
    const { id } = params;

    const existing = await priceSchemeService.show(id);
    if (!existing) throw new Error404('Skema harga tidak ditemukan');

    await priceSchemeService.remove(id);
    return res200({ res, message: 'Skema harga berhasil dihapus' });
  },
};
