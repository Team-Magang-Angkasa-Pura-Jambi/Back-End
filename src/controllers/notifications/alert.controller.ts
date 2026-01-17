import type { Request, Response, NextFunction } from 'express';
import { alertService } from '../../services/notifications/alert.service.js';
import { res200 } from '../../utils/response.js';
import { Error401 } from '../../utils/customError.js';

class AlertController {
  public getSystemAlerts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, meta } = await alertService.getSystemAlerts();

      res200({
        res,
        data: { meters: data, meta },

        message: 'Alert sistem berhasil diambil.',
      });
    } catch (error) {
      next(error);
    }
  };

  public getMeterAlerts = async (req: Request, res: Response, next: NextFunction) => {
    const { data, meta } = await alertService.getMetersAlerts();
    res200({
      res,
      data: { alerts: data, meta },
      message: 'Alert meter berhasil diambil.',
    });
  };

  public getLatest = async (req: Request, res: Response, next: NextFunction) => {
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
  public getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
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

  public acknowledge = async (req: Request, res: Response, next: NextFunction) => {
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

  public acknowledgeAll = async (req: Request, res: Response, next: NextFunction) => {
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

  public bulkDelete = async (req: Request, res: Response, next: NextFunction) => {
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

  public updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { alertId } = res.locals.validatedData.params;
      const updatedAlert = await alertService.updateStatus(alertId);

      res200({
        res,
        data: updatedAlert,
        message: `Alert marked as read.`,
      });
    } catch (error) {
      next(error);
    }
  };

  public bulkUpdateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { alertIds } = res.locals.validatedData.body;
      const updatedAlerts = await Promise.all(
        alertIds.map((alertId: number) => alertService.updateStatus(alertId)),
      );

      res200({
        res,
        data: updatedAlerts,
        message: `Status alert berhasil diubah untuk ${updatedAlerts.length} alert.`,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const alertController = new AlertController();
