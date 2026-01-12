import type { Request, Response } from 'express';
import { res200 } from '../utils/response.js'; // Path import yang benar

export const index = (req: Request, res: Response) => {
  const message = 'Sentinel API v1 Ready to use (❁´◡`❁) Happy Coding!';

  const data = {
    status: 'Online',
    version: '1.0.0',
    serverTime: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
  };

  return res200({ res, message, data });
};
