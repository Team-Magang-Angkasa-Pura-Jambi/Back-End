import type { Request, Response } from 'express';
import { RecapService } from '../services/recap.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class RecapController {
  private service = new RecapService();

  public getRecap = async (req: Request, res: Response) => {
    const validatedQuery = res.locals.validatedData.query;
    const result = await this.service.getRecap(validatedQuery);
    res.status(200).json({ status: 'success', ...result });
  };
}

export const recapController = new RecapController();
