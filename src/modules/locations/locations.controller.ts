import { type Request, type Response, type NextFunction } from 'express';
import { locationsService } from './locations.service.js';
import { res200, res201 } from '../../utils/response.js';
import { Error404 } from '../../utils/customError.js';

export const locationsController = {
  store: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user_id = req.user?.id;

      if (!user_id) throw new Error404('User ID tidak ditemukan');

      const { body } = res.locals.validatedData;

      body.created_by = user_id;

      const data = await locationsService.store(body);

      return res201({
        res,
        message: 'Data Lokasi Berhasil Ditambahkan!',
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  show: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { params, query } = res.locals.validatedData;

      const data = await locationsService.show(params?.id, query);

      return res200({
        res,
        message: 'Berhasil mendapatkan data Lokasi',
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  patch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user_id = req.user?.id;

      if (!user_id) throw new Error404('User ID tidak ditemukan');

      const { params, body } = res.locals.validatedData;

      body.updated_by = user_id;

      const data = await locationsService.patch(params.id, body);

      return res200({
        res,
        message: 'Data Lokasi berhasil diperbarui',
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { params } = res.locals.validatedData;

      await locationsService.remove(params.id);

      return res200({
        res,
        message: 'Data Lokasi berhasil dihapus',
      });
    } catch (error) {
      next(error);
    }
  },
};
