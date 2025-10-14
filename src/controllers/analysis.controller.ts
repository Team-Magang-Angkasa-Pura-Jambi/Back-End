import type { Request, Response, NextFunction } from 'express';
import { AnalysisService } from '../services/analysis.service.js';
import { res200 } from '../utils/response.js';
import { Error401 } from '../utils/customError.js';

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
        data: result, // PERBAIKAN: Gunakan spread operator untuk memisahkan 'meta' dan 'data'
        message: 'Ringkasan konsumsi hari ini berhasil diambil.',
      });
    } catch (error) {
      next(error);
    }
  };
  public runBulkPredictions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = (req as any).user;
      if (!user || !user.id) {
        throw new Error401(
          'Data pengguna tidak ditemukan. Sesi mungkin tidak valid.'
        );
      }

      const { startDate, endDate } = res.locals.validatedData.body;

      // Jalankan di latar belakang, jangan ditunggu (no await)
      this.analysisService.runBulkPredictions({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        userId: Number(user.id),
      });

      res200({
        res,
        message: 'Proses prediksi massal telah dimulai di latar belakang.',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const analysisController = new AnalysisController();
