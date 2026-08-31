import { type Request, type Response } from 'express';
import { menusService } from './menus.service.js';
import { res200 } from '../../utils/response.js';

export const menusController = {
  index: async (req: Request, res: Response) => {
    const data = await menusService.getAll();
    return res200({ res, message: 'Berhasil mengambil semua menu', data });
  },

  show: async (req: Request, res: Response) => {
    const { params } = req;
    const data = await menusService.getById(Number(params.id));
    return res200({ res, message: 'Berhasil mengambil menu', data });
  },

  store: async (req: Request, res: Response) => {
    const { body } = res.locals.validatedData;
    const data = await menusService.create(body);
    return res200({ res, message: 'Berhasil menambahkan menu', data });
  },

  patch: async (req: Request, res: Response) => {
    const { params, body } = res.locals.validatedData;
    const menu_id = Number(params.id);
    
    const data = await menusService.update(menu_id, body);
    return res200({ res, message: 'Berhasil memperbarui menu', data });
  },

  destroy: async (req: Request, res: Response) => {
    const { params } = res.locals.validatedData;
    const menu_id = Number(params.id);

    const data = await menusService.delete(menu_id);
    return res200({ res, message: 'Berhasil menghapus menu', data });
  },
};
