import { Request, Response } from 'express';
import { visualizationService } from './visualization.service.js';
import { res200 } from '../../utils/response.js';

export const visualizationController = {
  MetricCards: async (req: Request, res: Response) => {
    const { year, month } = res.locals.validatedData.query || {};

    const data = await visualizationService.MetricCards(year, month);

    return res200({
      res,
      message: 'Berhasil memuat data visualisasi metrik',
      data,
    });
  },
  YearlyHeatmap: async (req: Request, res: Response) => {
    const { meterId, year } = res.locals.validatedData.query || {};

    const data = await visualizationService.getYearlyHeatmapService(meterId, year);

    return res200({
      res,
      message: 'Berhasil memuat data visualisasi Heat Map',
      data,
    });
  },
  yearlyAnalysis: async (req: Request, res: Response) => {
    const { energyId, year } = res.locals.validatedData.query || {};

    const data = await visualizationService.yearlyAnalysis(energyId, year);

    return res200({
      res,
      message: 'Berhasil memuat data visualisasi analisis tahunan',
      data,
    });
  },
  trentConsumption: async (req: Request, res: Response) => {
    const { energyId, year, month, meterId } = res.locals.validatedData.query;

    const data = await visualizationService.trentConsumption(energyId, year, month, meterId);

    return res200({
      res,
      message: 'Berhasil memuat data visualisasi tren konsumsi bulanan',
      data,
    });
  },
  getEnergyPaxCorrelation: async (req: Request, res: Response) => {
    const { year, month } = res.locals.validatedData.query;

    const data = await visualizationService.getEnergyPaxCorrelation(year, month);

    return res200({
      res,
      message: 'Berhasil memuat data korelasi energi dan kepadatan penumpang',
      data,
    });
  },
  getYearlyLogistics: async (req: Request, res: Response) => {
    const { meterId, year } = res.locals.validatedData.query;

    const data = await visualizationService.getYearlyLogistics(meterId, year);

    return res200({
      res,
      message: 'Berhasil memuat analisis logistik dan sisa stok BBM tahunan',
      data,
    });
  },
  getTodaySummary: async (req: Request, res: Response) => {
    const { energyId } = res.locals.validatedData.query;

    const data = await visualizationService.getTodaySummary(energyId);

    return res200({
      res,
      message: 'Berhasil memuat ringkasan konsumsi energi dan operasional hari ini',
      data,
    });
  },
  getCardConfig: async (req: Request, res: Response) => {
    const data = await visualizationService.getCardConfig();

    return res200({
      res,
      message: 'Berhasil memuat konfigurasi meteran kartu dashboard',
      data,
    });
  },
  updateCardConfig: async (req: Request, res: Response) => {
    const body = res.locals.validatedData?.body || req.body || {};
    const userId = (req as any).user?.user_id;

    const data = await visualizationService.updateCardConfig(body, userId);

    return res200({
      res,
      message: 'Konfigurasi meteran kartu dashboard berhasil diperbarui',
      data,
    });
  },
};
