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

  public getMonthlyFuelStockAnalysis = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const query = res.locals.validatedData.query;
      const result =
        await this.analysisService.getMonthlyFuelStockAnalysis(query);
      res200({
        res,
        data: result,
        message: 'Analisis sisa stok BBM bulanan berhasil diambil.',
      });
    } catch (error) {
      next(error);
    }
  };

  public getBudgetAllocation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { year } = res.locals.validatedData.query;
      const result = await this.analysisService.getBudgetAllocation(
        Number(year)
      );
      res200({
        res,
        data: result,
        message: `Alokasi anggaran untuk tahun ${year} berhasil diambil.`,
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

  public getBudgetPreview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // Ambil data anggaran sementara dari body request
      const budgetData = res.locals.validatedData.body;
      const result =
        await this.analysisService.getBudgetAllocationPreview(budgetData);
      res200({
        res,
        data: result,
        message: `Pratinjau alokasi anggaran berhasil dihitung.`,
      });
    } catch (error) {
      next(error);
    }
  };

  public getBudgetSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await this.analysisService.getBudgetSummary();
      res200({
        res,
        data: result,
        message: `Ringkasan anggaran per jenis energi berhasil diambil.`,
      });
    } catch (error) {
      next(error);
    }
  };

  public prepareNextPeriodBudget = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { parentBudgetId } = res.locals.validatedData.params;
      const result =
        await this.analysisService.prepareNextPeriodBudget(parentBudgetId);
      res200({
        res,
        data: result,
        message: `Data persiapan untuk anggaran periode berikutnya berhasil diambil.`,
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

  public runSinglePrediction = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { date, meterId } = res.locals.validatedData.body;
      const baseDate = new Date(date);

      // Panggil service untuk menjalankan prediksi dan tunggu hingga selesai.
      // PERBAIKAN: Kirim meterId ke service
      await this.analysisService.runPredictionForDate(baseDate, meterId);

      res200({
        res,
        message: `Proses prediksi untuk meter ID ${meterId} berdasarkan data tanggal ${date} telah berhasil dijalankan.`,
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

  public runSingleClassification = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { date, meterId } = res.locals.validatedData.body;
      const targetDate = new Date(date);

      await this.analysisService.runSingleClassification(
        targetDate,
        Number(meterId)
      );

      res200({
        res,
        message: `Proses klasifikasi untuk meter ID ${meterId} pada tanggal ${date} telah berhasil dijalankan.`,
      });
    } catch (error) {
      next(error);
    }
  };

  public getEfficiencyTargetPreview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { target_value, meter_id, period_start, period_end } =
        res.locals.validatedData.body;
      const result = await this.analysisService.getEfficiencyTargetPreview({
        target_value,
        meterId: meter_id,
        periodStartDate: period_start,
        periodEndDate: period_end,
      });

      res200({
        res,
        data: result,
        message: `Pratinjau target efisiensi berhasil dihitung.`,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const analysisController = new AnalysisController();
