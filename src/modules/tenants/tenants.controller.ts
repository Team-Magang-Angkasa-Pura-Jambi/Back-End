// Generated for Sentinel Project

import { type NextFunction, type Request, type Response } from 'express';
import { tenantsService } from './tenants.service.js';
import { res200, res201 } from '../../utils/response.js';
import { Error404 } from '../../utils/customError.js';

export const tenantsControllers = {
  store: async (req: Request, res: Response, next: NextFunction) => {
    const user_id = req.user?.id;
    if (!user_id) throw new Error404('User ID tidak ditemukan');

    const { body } = res.locals.validatedData;

    body.create_by = user_id;

    const data = await tenantsService.store(body);
    return res201({
      res,
      message: 'Tenant berhasil ditambahkan',
      data,
    });
  },

  show: async (req: Request, res: Response, next: NextFunction) => {
    const { params, query } = res.locals.validatedData;
    const data = await tenantsService.show(Number(params.id), query);
    return res200({
      res,
      message: 'Tenant berhasil ditemukan',
      data,
    });
  },

  showCategories: async (req: Request, res: Response, next: NextFunction) => {
    const data = await tenantsService.showCategory();
    return res200({
      res,
      message: 'Kategori berhasil ditemukan',
      data,
    });
  },

  patch: async (req: Request, res: Response, next: NextFunction) => {
    const user_id = req.user?.id;
    if (!user_id) throw new Error404('User ID tidak ditemukan');

    const { params, body } = res.locals.validatedData;

    if (!params) throw new Error404('ID tidak ditemukan');

    const id = params.id;

    body.updated_by = user_id;

    const data = await tenantsService.patch(id, body);

    return res201({
      res,
      message: 'Tenant berhasil diperbarui',
      data,
    });
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    const { params } = res.locals.validatedData;

    if (!params) throw new Error404('ID tidak ditemukan');

    const id = params.id;

    await tenantsService.remove(Number(id));
  },
};
