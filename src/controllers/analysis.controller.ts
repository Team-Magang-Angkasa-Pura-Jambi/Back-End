import type { Request, Response, NextFunction } from 'express';
import { AnalysisService } from '../services/analysis.service.js';
import { res200 } from '../utils/response.js';

class AnalysisController {
  private analysisService = new AnalysisService();

  public getMonthlyAnalysis = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const query = res.locals.validatedData.query;
      const result = await this.analysisService.getMonthlyAnalysis(query);
      res200({
        res,
        data: result,
        message: 'Analisis bulanan berhasil diambil.',
      });
    } catch (error) {
      next(error);
    }
  };

  public getClassificationSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const query = res.locals.validatedData.query;
      const result = await this.analysisService.getClassificationSummary(query);
      res200({
        res,
        data: result,
        message: 'Ringkasan klasifikasi berhasil diambil.',
      });
    } catch (error) {
      next(error);
    }
  };

  public getTodaySummary = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { energyType } = res.locals.validatedData.query;
      const result = await this.analysisService.getTodaySummary(energyType);
      res200({
        res,
        data: result,
        message: 'Ringkasan konsumsi hari ini berhasil diambil.',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const analysisController = new AnalysisController();
