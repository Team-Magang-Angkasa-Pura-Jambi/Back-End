import { type Request, type Response } from 'express';
import { budgetService } from './annual_budgets.service.js';
import { res200, res201 } from '../../utils/response.js';
import { Error404 } from '../../utils/customError.js';

export const budgetController = {
  store: async (req: Request, res: Response) => {
    const { body } = res.locals.validatedData;
    if (req.user?.id) body.budget.created_by = Number(req.user.id);

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
    if (req.user?.id) body.budget.updated_by = Number(req.user.id);

    const data = await budgetService.patch(params.id, body);
    return res200({ res, message: 'Anggaran berhasil diperbarui', data });
  },

  remove: async (req: Request, res: Response) => {
    const { params } = res.locals.validatedData;
    await budgetService.remove(params.id);
    return res200({ res, message: 'Anggaran berhasil dihapus' });
  },
  showRemaining: async (req: Request, res: Response) => {
    const { params } = res.locals.validatedData;
    const data = await budgetService.showRemaining(params.id);
    return res200({ res, message: 'Anggaran yang tersisa', data });
  },
};
