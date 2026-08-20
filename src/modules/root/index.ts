import { type Request, type Response } from 'express';
import { res200 } from '../../utils/response.js';

export const root = (req: Request, res: Response) => {
  /* #swagger.tags = ['Root']
    #swagger.summary = 'Cek Status Server'
    #swagger.description = 'Endpoint ini buat ngecek apakah server backend hidup atau mati.'
    #swagger.responses[200] = {
        description: 'Server OK',
        schema: {
            status: {
                code: 200,
                message: "Sentinel API v2 Ready to use (❁´◡`❁) Happy Coding!"
            },
            data: {
                status: "Online",
                version: "2.0.0",
                serverTime: "17/2/2026, 21.45.04 WIB"
            }
        }
    }
*/
  const message = 'Sentinel API v2 Ready to use (❁´◡`❁) Happy Coding!';

  const data = {
    status: 'Online',
    version: '2.0.0',
    serverTime: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
  };

  return res200({ res, message, data });
};
