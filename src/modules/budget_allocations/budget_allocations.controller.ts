import { type Request, type Response } from 'express';
import { allocationService } from './budget_allocations.service.js';
import { res200, res201 } from '../../utils/response.js';
import { Error404 } from '../../utils/customError.js';

export const allocationController = {
  store: async (req: Request, res: Response) => {
    const { body } = res.locals.validatedData;
    const data = await allocationService.store(body);
    return res201({ res, message: 'Alokasi berhasil ditambahkan', data });
  },

  show: async (req: Request, res: Response) => {
    const { params, query } = res.locals.validatedData;
    if (params?.id) {
      const data = await allocationService.show(params.id);
      if (!data) throw new Error404('Alokasi tidak ditemukan');
      return res200({ res, message: 'Detail Alokasi', data });
    }
    const data = await allocationService.show(undefined, query);
    return res200({ res, message: 'Daftar Alokasi Meter', data });
  },

  update: async (req: Request, res: Response) => {
    const { params, body } = res.locals.validatedData;
    if (!params) throw new Error404('ID tidak ditemukan');
    const data = await allocationService.patch(params.id, body);
    return res200({ res, message: 'Alokasi berhasil diperbarui', data });
  },

  remove: async (req: Request, res: Response) => {
    const { params } = res.locals.validatedData;
    if (!params) throw new Error404('ID tidak ditemukan');

    await allocationService.remove(params.id);
    return res200({ res, message: 'Alokasi berhasil dihapus' });
  },
};
