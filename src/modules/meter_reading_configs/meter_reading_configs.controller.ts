import { type Request, type Response } from 'express';
import { meterConfigsService } from './meter_reading_configs.service.js';
import { res200, res201 } from '../../utils/response.js';
import { Error404 } from '../../utils/customError.js';

export const meterConfigsController = {
  store: async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new Error404('User tidak ditemukan');

    const { body } = res.locals.validatedData;

    body.config.created_by = Number(userId);

    const data = await meterConfigsService.store(body);
    return res201({ res, message: 'Config Meter berhasil ditambahkan', data });
  },

  show: async (req: Request, res: Response) => {
    const { params, query } = res.locals.validatedData;

    if (params?.id) {
      const result = await meterConfigsService.show(params.id);

      if (!result) throw new Error404('Config Meter tidak ditemukan');

      return res200({
        res,
        message: 'Detail Config Meter',
        data: result,
      });
    }

    const result = await meterConfigsService.show(undefined, query);

    const listResult = result as unknown as { config: any[]; meta: any };

    return res200({
      res,
      message: 'Daftar Config Meter',
      data: listResult.config,
      meta: listResult.meta,
    });
  },

  update: async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { params, body } = res.locals.validatedData;

    if (!params) throw new Error404('ID tidak ditemukan');

    const configId = Number(params.id);

    if (userId) body.config.updated_by = Number(userId);

    const data = await meterConfigsService.patch(configId, body);

    return res200({ res, message: 'Config Meter berhasil diperbarui', data });
  },

  remove: async (req: Request, res: Response) => {
    const { params } = res.locals.validatedData;

    if (!params) throw new Error404('ID tidak ditemukan');

    const configId = Number(params.id);

    const existing = await meterConfigsService.show(configId);

    if (!existing) throw new Error404('Config Meter tidak ditemukan');

    const data = await meterConfigsService.remove(configId);

    return res200({ res, message: 'Config Meter berhasil dihapus', data });
  },
};
