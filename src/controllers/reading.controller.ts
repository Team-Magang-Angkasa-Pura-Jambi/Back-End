import type { Request, Response } from 'express';
import type { ReadingService } from '../services/reading.service.js';
import type {
  CreateReadingSessionBody,
  GetReadingsQuery,
  IdParams,
} from '../types/reading.types.js';
import { res200, res201 } from '../utils/response.js';
import { Error401 } from '../utils/customError.js';

/**
 * Controller untuk menangani request HTTP terkait Sesi Pembacaan.
 */
export class ReadingController {
  constructor(private readingService: ReadingService) {}

  public getReadings = async (
    req: Request<{}, {}, {}, GetReadingsQuery>,
    res: Response
  ) => {
    const readings = await this.readingService.findAll(req.query);
    res200({
      res,
      message: 'Berhasil mengambil data pembacaan.',
      data: readings,
    });
  };

  public getById = async (req: Request<IdParams>, res: Response) => {
    const sessionId = res.locals.validatedData.params.id;
    const reading = await this.readingService.findById(sessionId);
    res200({
      res,
      message: 'Berhasil mengambil detail sesi pembacaan.',
      data: reading,
    });
  };

  public create = async (
    req: Request<{}, {}, CreateReadingSessionBody>,
    res: Response
  ) => {
    const user_id = req.user?.id;

    if (!user_id) {
      throw new Error401('User not authenticated');
    }

    req.body.user_id = user_id;

    res.locals.validatedData.body.user_id = user_id;

    const newReading = await this.readingService.create(
      res.locals.validatedData.body
    );

    
    res201({
      res,
      message: 'Data pembacaan baru berhasil dibuat.',
      data: newReading,
    });
  };

  public createCorrection = async (
    req: Request<IdParams, {}, CreateReadingSessionBody>,
    res: Response
  ) => {
    const originalSessionId = res.locals.validatedData.params.id;
    const user_id = req.user?.id;

    if (!user_id) {
      throw new Error401('User not authenticated');
    }

    res.locals.validatedData.body.user_id = user_id;

    const correctedReading = await this.readingService.createCorrection(
      originalSessionId,
      res.locals.validatedData.body
    );
    
    res201({
      res,
      message: 'Data koreksi berhasil dibuat.',
      data: correctedReading,
    });
  };

  public delete = async (req: Request<IdParams>, res: Response) => {
    const sessionId = res.locals.validatedData.params.id;

    const deletedReading = await this.readingService.delete(sessionId);
    res200({
      res,
      message: 'Data pembacaan berhasil dihapus.',
      data: deletedReading,
    });
  };
}
