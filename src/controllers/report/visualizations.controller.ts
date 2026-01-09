import { NextFunction, Request, Response } from 'express';
import {
  EnergyOutlookService,
  getBudgetTrackingService,
  getDailyAveragePaxService,
  getEfficiencyRatioService,
  getUnifiedComparisonService,
  getYearlyAnalysisService,
  getYearlyHeatmapService,
  MeterRankService,
} from '../../services/reports/visualizations.service.js';
import { res200 } from '../../utils/response.js';

export const MeterRankController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await MeterRankService();
    res200({ res, data, message: 'success' });
  } catch (error) {
    next(error);
  }
};

export const EnergyOutlookController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await EnergyOutlookService();
    res200({ res, data, message: 'success' });
  } catch (error) {
    next(error);
  }
};

export const getYearlyHeatmapController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { meterId, year } = res.locals.validatedData.query;
    const data = await getYearlyHeatmapService(meterId, year);
    res200({ res, data, message: 'success' });
  } catch (error) {
    next(error);
  }
};

export const getBudgetTrackingController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getBudgetTrackingService();
    res200({ res, data, message: 'success' });
  } catch (error) {
    next(error);
  }
};

export const getYearlyAnalysisController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { energyTypeName, year } = res.locals.validatedData.query;
    if (!energyTypeName) {
      throw new Error('energyTypeName is required');
    }
    const data = await getYearlyAnalysisService(energyTypeName, year);
    res200({ res, data, message: 'success' });
  } catch (error) {
    next(error);
  }
};
export const getUnifiedComparisonController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { energyTypeName, year, month } = res.locals.validatedData.query;
    if (!energyTypeName || !year || !month) {
      throw new Error('filters is required');
    }
    const result = await getUnifiedComparisonService(
      energyTypeName,
      year,
      month
    );
    return res200({ res, data: result, message: 'success' });
  } catch (error) {
    next(error);
  }
};

export const getEfficiencyRatioController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { year, month } = res.locals.validatedData.query;
    const result = await getEfficiencyRatioService(year, month);
    return res200({ res, data: result, message: 'success' });
  } catch (error) {
    next(error);
  }
};

export const getDailyAveragePaxController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { year, month } = res.locals.validatedData.query;
    const result = await getDailyAveragePaxService(year, month);
    return res200({ res, data: result, message: 'success' });
  } catch (error) {
    next(error);
  }
};
