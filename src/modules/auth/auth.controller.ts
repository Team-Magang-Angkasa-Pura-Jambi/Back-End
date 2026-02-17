import { type NextFunction, type Request, type Response } from 'express';
import { authService } from './auth.service.js';
import { res200 } from '../../utils/response.js';

// Generated for Sentinel Project
export const authContorller = {
  login: async (req: Request, res: Response, next: NextFunction) => {
    const { body } = res.locals.validatedData;

    const data = await authService.login(body);
    return res200({ res, message: 'Berhasil Login', data });
  },
};
