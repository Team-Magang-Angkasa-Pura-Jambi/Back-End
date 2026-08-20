import { type Request, type Response } from 'express';
import { formulaService } from './formula_definitions.service.js';
import { res200, res201 } from '../../utils/response.js';
import { Error404 } from '../../utils/customError.js';

export const formulaController = {
  show: async (req: Request, res: Response) => {
    const { params, query } = res.locals.validatedData;

    if (params?.id) {
      const data = await formulaService.show(params.id);
      if (!data) throw new Error404('Formula tidak ditemukan');
      return res200({ res, message: 'Detail Formula', data });
    }

    const data = await formulaService.show(undefined, query);
    return res200({ res, message: 'Daftar Formula Definition', data });
  },

  store: async (req: Request, res: Response) => {
    const { body } = res.locals.validatedData;
    const data = await formulaService.store(body);
    return res201({ res, message: 'Formula berhasil ditambahkan', data });
  },

  update: async (req: Request, res: Response) => {
    const { params, body } = res.locals.validatedData;
    const data = await formulaService.patch(params.id, body);
    if (!data) throw new Error404('Formula tidak ditemukan');
    return res200({ res, message: 'Formula berhasil diperbarui', data });
  },

  remove: async (req: Request, res: Response) => {
    const { params } = res.locals.validatedData;
    await formulaService.remove(params.id);
    return res200({ res, message: 'Formula berhasil dihapus' });
  },
};
