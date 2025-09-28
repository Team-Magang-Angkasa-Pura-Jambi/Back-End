import type { Request, Response } from 'express';
import { ReadingService } from '../services/reading.service.js';
import type {
  CreateReadingSessionBody,
  GetReadingSessionsQuery,
  UpdateReadingSessionBody,
} from '../types/reading.types.js';
import { res200, res201 } from '../utils/response.js';
import { Error401 } from '../utils/customError.js';
import { BaseController } from '../utils/baseController.js';
import type { ReadingSession } from '../generated/prisma/index.js';

/**
 * Controller untuk menangani request HTTP terkait Sesi Pembacaan.
 */

type CreateReadingSessionInternal = CreateReadingSessionBody & {
  user_id: number;
};
export class ReadingController extends BaseController<
  ReadingSession,
  CreateReadingSessionBody,
  UpdateReadingSessionBody,
  GetReadingSessionsQuery,
  ReadingService
> {
  constructor() {
    super(new ReadingService(), 'sessionId');
  }
  public override getAll = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const validatedQuery = res.locals.validatedData;
    console.log(validatedQuery);

    const result = await this.service.findAllWithFilters(validatedQuery);

    res200({ res, message: 'success', data: result });
  };

  public getLastReading = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const { meterId, readingTypeId } = res.locals.validatedData.query;

    const result = await this.service.findLastReading({
      meterId,
      readingTypeId,
    });

    res200({ res, message: 'success', data: result });
  };

  public override create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const validatedBody = res.locals.validatedData.body;
    console.log(req.user);
    const user_id = req.user?.id;
    if (!user_id) {
      throw new Error401('User not authenticated or user ID is missing.');
    }

    const internalData: CreateReadingSessionInternal = {
      ...validatedBody,
      user_id,
      reading_date: validatedBody.reading_date
        ? new Date(validatedBody.reading_date)
        : new Date(),
    };
    const record = await this.service.create(internalData);
    res.status(201).json({ status: 'success', data: record });
  };

  public createCorrection = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const originalSessionId = res.locals.validatedData.params;
    const validatedBody = res.locals.validatedData.body;

    const internalData: CreateReadingSessionInternal = {
      ...validatedBody,
      user_id: res.locals.user.id,
      reading_date: validatedBody.reading_date
        ? new Date(validatedBody.reading_date)
        : new Date(),
    };

    const record = await this.service.createCorrection(
      originalSessionId,
      internalData
    );
    res.status(201).json({ status: 'success', data: record });
  };
}

export const readingController = new ReadingController();
