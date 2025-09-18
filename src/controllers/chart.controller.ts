import type { Request, Response } from 'express';
import type { ChartService } from '../services/chart.service';
import { res200 } from '../utils/response';
import type { GetChartDataQuery } from '../types/chart.type';

/**
 * Controller untuk menangani request HTTP terkait data Chart.
 */
export class ChartController {
  constructor(private chartService: ChartService) {}

  public getChartData = async (
    req: Request<{}, {}, {}, GetChartDataQuery>,
    res: Response
  ) => {
    const chartData = await this.chartService.getChartData(req.query);
    res200({
      res,
      message: 'Berhasil mengambil data chart.',
      data: chartData,
    });
  };
}
