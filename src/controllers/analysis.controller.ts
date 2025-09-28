import type { Request, Response } from 'express';
import { AnalysisService } from '../services/analysis.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { res200 } from '../utils/response.js';

class AnalysisController {
  private service = new AnalysisService();

  public getAnalysis = async (req: Request, res: Response) => {
    const validatedQuery = res.locals.validatedData.query;
    const result = await this.service.getMonthlyAnalysis(validatedQuery);
    res200({ res, message: 'success', data: result });
  };
}

export const analysisController = new AnalysisController();
