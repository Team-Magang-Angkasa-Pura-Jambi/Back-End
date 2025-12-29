import type { Request, Response, NextFunction } from 'express';
import { res200, res201 } from '../../utils/response.js';
import { Error401 } from '../../utils/customError.js';
import { dailyLogbookService } from '../../services/operations/dailyLogbook.service.js';

class DailyLogbookController {
  public getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedData.query;

      const { data } = await dailyLogbookService.findAllPaginated(query);
      res200({ res, data, message: 'Logbook ditemukan' });
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { logId } = res.locals.validatedData.params;
      const logbook = await dailyLogbookService.findById(logId);
      res200({ res, data: logbook, message: 'Logbook ditemukan' });
    } catch (error) {
      next(error);
    }
  };

  public generate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { date } = res.locals.validatedData.body;
      const result = await dailyLogbookService.generateDailyLog(new Date(date));
      res201({
        res,
        data: result,
        message: `Berhasil membuat/memperbarui ${result.length} logbook harian.`,
      });
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        throw new Error401('Data pengguna tidak valid.');
      }

      const { logId } = res.locals.validatedData.params;
      const { manual_notes } = res.locals.validatedData.body;

      const updatedLogbook = await dailyLogbookService.update(logId, {
        manual_notes,
        edited_by_user_id: Number(user.id),
      });

      res200({
        res,
        data: updatedLogbook,
        message: 'Catatan manual berhasil diperbarui.',
      });
    } catch (error) {
      next(error);
    }
  };

  public delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { logId } = res.locals.validatedData.params;
      await dailyLogbookService.delete(logId);
      res200({ res, message: 'Logbook berhasil dihapus.' });
    } catch (error) {
      next(error);
    }
  };
}

export const dailyLogbookController = new DailyLogbookController();
