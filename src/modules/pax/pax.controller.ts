import { Request, Response } from 'express';
import { paxService } from './pax.service.js';
import { res200, res201, res404, res500 } from '../../utils/response.js';
// Asumsi import helper respons Anda

export const paxController = {
  show: async (req: Request, res: Response) => {
    const query = res.locals.validatedData.query;
    const result = await paxService.show(query);

    return res200({
      res,
      message: 'Berhasil memuat data pax',
      data: result,
    });
  },

  getById: async (req: Request, res: Response) => {
    const { id } = res.locals.validatedData.params;
    const pax = await paxService.getById(id);

    if (!pax) {
      return res404({ res, message: 'Data pax tidak ditemukan' });
    }

    return res200({
      res,
      message: 'Berhasil memuat detail data pax',
      data: pax,
    });
  },

  store: async (req: Request, res: Response) => {
    const data = res.locals.validatedData.body;
    const result = await paxService.store(data);

    if (result instanceof Error) {
      return res500({ res, message: result.message });
    }

    return res201({
      res,
      message: 'Data pax berhasil ditambahkan',
      data: result,
    });
  },

  update: async (req: Request, res: Response) => {
    const { id } = res.locals.validatedData.params;
    const data = res.locals.validatedData.body;

    const result = await paxService.update(id, data);

    if (result instanceof Error) {
      return res500({ res, message: result.message });
    }

    return res200({
      res,
      message: 'Data pax berhasil diperbarui',
      data: result,
    });
  },

  remove: async (req: Request, res: Response) => {
    const { id } = res.locals.validatedData.params;
    const result = await paxService.remove(id);

    if (result instanceof Error) {
      return res500({ res, message: result.message });
    }

    return res200({
      res,
      message: 'Data pax berhasil dihapus',
      data: null,
    });
  },
};
