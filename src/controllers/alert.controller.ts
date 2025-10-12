import type { Request, Response, NextFunction } from 'express';
import { alertService } from '../services/alert.service.js';
import { res200 } from '../utils/response.js';
import { Error401 } from '../utils/customError.js';

class AlertController {
  public getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // PERBAIKAN: Panggil service yang sudah memiliki logika paginasi yang benar.
      const query = res.locals.validatedData.query;
      const { data, meta } = await alertService.findAllWithQuery(query);
      res200({
        res,
        data, // Kembalikan data langsung
        meta, // Kembalikan meta untuk info paginasi
        message: 'Alerts berhasil diambil.',
      });
    } catch (error) {
      next(error);
    }
  };

  public getSystemAlerts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const query = res.locals.validatedData.query;
      const { data, meta } = await alertService.findAllWithQuery(
        query,
        'system'
      );

      res200({
        res,
        data: { data, meta },
        message: 'Alert sistem berhasil diambil.',
      });
    } catch (error) {
      next(error);
    }
  };

  public getMeterAlerts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const query = res.locals.validatedData.query;
    const { data, meta } = await alertService.findAllWithQuery(query, 'meters');
    res200({
      res,
      data: { data, meta },
      message: 'Alert meter berhasil diambil.',
    });
  };

  public getLatest = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { scope, status } = res.locals.validatedData.query;
      const result = await alertService.getLatest(scope, 5, status);
      res200({
        res,
        data: result,
        message: 'Alert terbaru berhasil diambil.',
      });
    } catch (error) {
      next(error);
    }
  };
  public getUnreadCount = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { meterId } = res.locals.validatedData.query;
      const count = await alertService.getUnreadCount(meterId);
      res200({
        res,
        data: { count },
        message: 'Jumlah alert berhasil diambil.',
      });
    } catch (error) {
      next(error);
    }
  };

  public acknowledge = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = (req as any).user;
      if (!user?.id) throw new Error401('User tidak terautentikasi.');

      const { alertId } = res.locals.validatedData.params;
      const alert = await alertService.acknowledge(alertId, Number(user.id));
      res200({
        res,
        data: alert,
        message: 'Alert ditandai sebagai acknowledged.',
      });
    } catch (error) {
      next(error);
    }
  };

  public acknowledgeAll = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = (req as any).user;
      if (!user?.id) throw new Error401('User tidak terautentikasi.');

      const result = await alertService.acknowledgeAll(Number(user.id));
      res200({
        res,
        data: { count: result.count },
        message: `${result.count} alert berhasil ditandai sebagai acknowledged.`,
      });
    } catch (error) {
      next(error);
    }
  };

  public bulkDelete = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { alertIds } = res.locals.validatedData.body;
      const result = await alertService.deleteManyByIds(alertIds);
      res200({
        res,
        message: `Berhasil menghapus ${result.count} alert.`,
        data: {
          count: result.count,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public updateStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = (req as any).user;
      if (!user?.id) throw new Error401('User tidak terautentikasi.');

      const { alertId } = res.locals.validatedData.params;
      const { status } = res.locals.validatedData.body;

      const updatedAlert = await alertService.updateStatus(
        alertId,
        status,
        Number(user.id)
      );

      res200({
        res,
        data: updatedAlert,
        message: `Status alert berhasil diubah menjadi ${status}.`,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const alertController = new AlertController();
