import type { Request, Response, NextFunction } from 'express';
import { res200 } from '../../utils/response.js';
import prisma from '../../configs/db.js';
import { machineLearningService } from '../../services/intelligence/machineLearning.service.js';

class MachineLearningController {
  /**
   * Memicu proses prediksi untuk tanggal tertentu dan menyimpannya ke database.
   */
  public runPrediction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { date } = req.body;

      const prediction = await machineLearningService.getDailyPrediction(date);

      if (prediction) {
        const METER_ID_LISTRIK = 9;

        await prisma.consumptionPrediction.upsert({
          where: {
            prediction_date_meter_id_model_version: {
              prediction_date: new Date(prediction.tanggal_prediksi),
              meter_id: METER_ID_LISTRIK,
              model_version: '1.1.0-pred',
            },
          },
          update: { predicted_value: prediction.prediksi_listrik_kwh },
          create: {
            prediction_date: new Date(prediction.tanggal_prediksi),
            predicted_value: prediction.prediksi_listrik_kwh,
            meter_id: METER_ID_LISTRIK,
            model_version: '1.1.0-pred',
          },
        });
      }

      res200({
        res,
        data: prediction,
        message: 'Proses prediksi berhasil dijalankan.',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const machineLearningController = new MachineLearningController();
