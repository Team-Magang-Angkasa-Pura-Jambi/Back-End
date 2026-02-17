// Generated for Sentinel Project

import { type NextFunction, type Request, type Response } from 'express';
import { rolesService } from './roles.service.js';
import { res200 } from '../../utils/response.js';

export const rolesController = {
  store: async (req: Request, res: Response, next: NextFunction) => {
    console.log('my :' + res.locals.validatedData);
    const { body } = res.locals.validatedData;

    const data = await rolesService.store(body);
    return res200({ res, message: 'Berhasil Menambahkan Data Role', data });
  },
  list: async (req: Request, res: Response, next: NextFunction) => {
    const { query } = req;
    const data = await rolesService.list(query);
    return res200({ res, message: 'Berhasil Mendapatkan Data Role', data });
  },
};
