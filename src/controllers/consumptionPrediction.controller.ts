
import { BaseController } from '../utils/baseController.js';
import type {
  ConsumptionPrediction,
} from '../generated/prisma/index.js';
import type {
  CreateConsumptionPredictionBody,
  GetConsumptionPredictionSchemaQuery,
  UpdateConsumptionPredictionSchemaBody,
} from '../types/ConsumptionPrediction.types.js';
import { ConsumptionPredictionService } from '../services/ConsumptionPrediction.service.js';
import axios from 'axios';
import type { Request, Response } from 'express';
import { res201 } from '../utils/response.js';
import { Error404 } from '../utils/customError.js';

interface PredictionResult {
  tanggal_prediksi: string;
  prediksi_listrik_kwh: number;
  prediksi_pax: number;
  prediksi_air_m3: number;
}

const ML_API_URL = 'http://127.0.0.1:8000/predict';
export class ConsumptionPredictionController extends BaseController<
  ConsumptionPrediction,
  CreateConsumptionPredictionBody,
  UpdateConsumptionPredictionSchemaBody,
  GetConsumptionPredictionSchemaQuery,
  ConsumptionPredictionService
> {
  constructor() {
    super(new ConsumptionPredictionService(), 'predictionId');
  }
  private async getDailyPrediction(
    tanggal: string
  ): Promise<PredictionResult | null> {
    try {
      // Mengirim request POST ke ML API dengan menyertakan tanggal
      const response = await axios.post<PredictionResult>(ML_API_URL, {
        tanggal: tanggal,
      });
      return response.data; // Mengembalikan objek JSON berisi angka-angka prediksi
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          'Error saat memanggil ML API:',
          error.response?.data || error.message
        );
      } else {
        console.error('Terjadi error yang tidak terduga:', error);
      }
      return null;
    }
  }

  public override create: any = async (req: Request, res: Response) => {
    const body: CreateConsumptionPredictionBody = res.locals.validatedData.body;

    const resultPredict = await this.getDailyPrediction(body.prediction_date);
    if (!resultPredict) {
      throw new Error404();
    }

    body.predicted_value = resultPredict.prediksi_listrik_kwh;

    const result = await this.service.create(body);
    res201({ res, message: 'Berhasil membuat data baru.', data: result });
  };
}
