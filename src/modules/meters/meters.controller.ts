import { type NextFunction, type Request, type Response } from 'express';
import { metersService } from './meters.service.js';
import { res200, res201 } from '../../utils/response.js';
import { Error404 } from '../../utils/customError.js';

export const metersController = {
  store: async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    const { body } = res.locals.validatedData;

    if (userId) {
      body.meter.created_by = Number(userId);
      if (body.meter_profile) {
        body.meter_profile.created_by = Number(userId);
      }
    }

    const data = await metersService.store(body);

    return res201({ res, message: 'Meter berhasil ditambahkan!', data });
  },

  show: async (req: Request, res: Response, next: NextFunction) => {
    const { params, query } = res.locals.validatedData;

    if (params?.id) {
      const data = await metersService.show(params.id);
      if (!data) throw new Error404('Meter tidak ditemukan');

      return res200({ res, message: 'Detail Meter ditemukan', data });
    }

    const data = await metersService.show(undefined, query);

    return res200({
      res,
      message: 'Daftar Meter ditemukan',
      data,
    });
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) throw new Error404('User tidak ditemukan');

    const { params, body } = res.locals.validatedData;

    if (!params) throw new Error404('ID tidak ditemukan');

    const meterId = Number(params.id);

    if (userId) {
      body.meter.updated_by = Number(userId);

      if (body.meter_profile) {
        body.meter_profile.updated_by = Number(userId);
      }
    }

    const data = await metersService.patch(meterId, body);

    return res200({ res, message: 'Meter berhasil diperbarui!', data });
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    const { params } = res.locals.validatedData;
    if (!params) throw new Error404('ID tidak ditemukan');

    const meterId = Number(params.id);

    const data = await metersService.remove(meterId);

    return res200({ res, message: 'Meter berhasil dihapus!', data });
  },
};
