import type { Request, Response, NextFunction } from 'express';
import { AnalysisService } from '../../services/reports/analysis.service.js';
import { res200 } from '../../utils/response.js';

class AnalysisController {
  private analysisService = new AnalysisService();
  // data untuk line chart

  // budget

  // summary
  public getTodaySummary = async (req: Request, res: Response, next: NextFunction) => {
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

  // efficient
}

export const analysisController = new AnalysisController();
