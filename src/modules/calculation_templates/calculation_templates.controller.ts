import { type Request, type Response } from 'express';
import { templateService } from './calculation_templates.service.js';
import { res200, res201 } from '../../utils/response.js';
import { Error404 } from '../../utils/customError.js';

export const templateController = {
  store: async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) throw new Error404('User tidak ditemukan');

    const { body } = res.locals.validatedData;

    body.template.created_by = Number(userId);

    const data = await templateService.store(body);

    return res201({ res, message: 'Template perhitungan berhasil dibuat', data });
  },

  show: async (req: Request, res: Response) => {
    const { params, query } = res.locals.validatedData;

    if (params?.id) {
      const result = await templateService.show(params.id);
      if (!result) throw new Error404('Template tidak ditemukan');
      return res200({ res, message: 'Detail Template', data: result });
    }

    const result = await templateService.show(undefined, query);

    const listResult = result as unknown as { data: any[]; meta: any };

    return res200({
      res,
      message: 'Daftar Template Perhitungan',
      data: listResult.data,
      meta: listResult.meta,
    });
  },

  update: async (req: Request, res: Response) => {
    const userId = req.user?.id;

    const { params, body } = res.locals.validatedData;

    if (!params) throw new Error404('ID tidak ditemukan');

    const { id } = params;

    if (userId) body.template.updated_by = Number(userId);

    const data = await templateService.patch(id, body);

    return res200({ res, message: 'Template berhasil diperbarui', data });
  },

  remove: async (req: Request, res: Response) => {
    const { params } = res.locals.validatedData;

    if (!params) throw new Error404('ID tidak ditemukan');

    const { id } = params;

    const existing = await templateService.show(id);
    if (!existing) throw new Error404('Template tidak ditemukan');

    await templateService.remove(id);

    return res200({ res, message: 'Template berhasil dihapus' });
  },
};
