import { Request, Response, NextFunction } from 'express';
import { res200 } from '../../utils/response.js';
import { systemConfigService } from './system_config.service.js';

export const systemConfigController = {
  getConfig: async (req: Request, res: Response, next: NextFunction) => {
    const data = await systemConfigService.getFullSettingsWithMeters();

    return res200({
      res,
      message: 'Berhasil mengambil konfigurasi global sistem',
      data,
    });
  },

  updateConfig: async (req: Request, res: Response, next: NextFunction) => {
    const body = res.locals.validatedData?.body || req.body;
    const userId = (req as any).user?.user_id;

    const data = await systemConfigService.updateConfig(body, userId);

    return res200({
      res,
      message: 'Konfigurasi sistem berhasil diperbarui!',
      data,
    });
  },

  testMl: async (req: Request, res: Response, next: NextFunction) => {
    const { url } = res.locals.validatedData?.body || req.body || {};
    const data = await systemConfigService.testMlConnection(url);

    return res200({
      res,
      message: data.message,
      data,
    });
  },

  testWeather: async (req: Request, res: Response, next: NextFunction) => {
    const { latitude, longitude, apiKey } = res.locals.validatedData?.body || req.body || {};
    const data = await systemConfigService.testWeatherConnection(latitude, longitude, apiKey);

    return res200({
      res,
      message: data.message,
      data,
    });
  },

  exportPackage: async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.user_id;
    const data = await systemConfigService.exportMasterPackage(userId);

    return res200({
      res,
      message: 'Paket Data Master & Kalkulasi berhasil diekspor!',
      data,
    });
  },

  importPackage: async (req: Request, res: Response, next: NextFunction) => {
    const body = res.locals.validatedData?.body || req.body;
    const userId = (req as any).user?.user_id;

    const data = await systemConfigService.importMasterPackage(body, userId);

    return res200({
      res,
      message: data.message,
      data,
    });
  },
};
