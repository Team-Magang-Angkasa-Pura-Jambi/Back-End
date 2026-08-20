import { type Request, type Response } from 'express';
import { budgetService } from './annual_budgets.service.js';
import { res200, res201 } from '../../utils/response.js';
import { Error400, Error404 } from '../../utils/customError.js';

export const budgetController = {
  store: async (req: Request, res: Response) => {
    const { body } = res.locals.validatedData;
    const userId = (req as any).user?.user_id || req.user?.id;

    if (userId) {
      body.created_by = Number(userId);
    }

    const data = await budgetService.store(body);
    return res201({ res, message: 'Anggaran tahunan berhasil dibuat', data });
  },

  show: async (req: Request, res: Response) => {
    const { params, query } = res.locals.validatedData;

    if (params?.id) {
      const data = await budgetService.show(params.id);
      if (!data) throw new Error404('Anggaran tidak ditemukan');
      return res200({ res, message: 'Detail Anggaran', data });
    }

    const result = (await budgetService.show(undefined, query)) as any;
    return res200({ res, message: 'Daftar Anggaran', data: result.data, meta: result.meta });
  },

  update: async (req: Request, res: Response) => {
    const { params, body } = res.locals.validatedData;
    const userId = (req as any).user?.user_id || req.user?.id;

    if (userId) {
      body.updated_by = Number(userId);
    }

    const data = await budgetService.patch(params.id, body);
    return res200({ res, message: 'Anggaran berhasil diperbarui', data });
  },

  remove: async (req: Request, res: Response) => {
    const { params } = res.locals.validatedData;
    const userId = (req as any).user?.user_id || req.user?.id;

    await budgetService.remove(params.id, userId ? Number(userId) : undefined);
    return res200({ res, message: 'Anggaran berhasil dihapus' });
  },

  showRemaining: async (req: Request, res: Response) => {
    const { params } = res.locals.validatedData;
    const data = await budgetService.showRemaining(params.id);
    return res200({ res, message: 'Anggaran yang tersisa', data });
  },

  getTracking: async (req: Request, res: Response) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const energyTypeId = Number(req.query.energy_type_id);

    if (!energyTypeId) {
      throw new Error400('energy_type_id wajib diisi');
    }

    const data = await budgetService.getTrackingData(year, energyTypeId);

    return res200({
      res,
      message: 'Berhasil mengambil data tracking anggaran',
      data,
    });
  },
};
