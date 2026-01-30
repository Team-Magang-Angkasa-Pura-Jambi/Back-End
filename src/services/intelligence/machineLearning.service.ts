import axios, { isAxiosError } from 'axios';
import { weatherService } from '../weather.service.js';

interface EvaluationInput {
  pax: number;
  suhu_rata: number;
  suhu_max: number;
  is_hari_kerja: number;
  aktual_kwh_terminal: number;
  aktual_kwh_kantor: number;
}

interface EvaluationResult {
  kinerja_terminal: string;
  deviasi_persen_terminal: number;
  kinerja_kantor: string;
  deviasi_persen_kantor: number;
}

interface EvaluationInputTerminal {
  pax: number;
  suhu_rata: number;
  suhu_max: number;
  aktual_kwh_terminal: number;
}

interface EvaluationInputKantor {
  suhu_rata: number;
  suhu_max: number;
  is_hari_kerja: number;
  aktual_kwh_kantor: number;
}

interface TerminalEvaluationResult {
  kinerja_terminal: string;
  deviasi_persen_terminal: number;
}

interface KantorEvaluationResult {
  kinerja_kantor: string;
  deviasi_persen_kantor: number;
}

interface PredictionResult {
  prediksi_pax: number;
  prediksi_kwh_terminal: number;
  prediksi_kwh_kantor: number;
  tanggal_prediksi: string;
  prediksi_listrik_kwh: number;
}

interface TerminalPredictionResult {
  prediksi_kwh_terminal: number;
}

interface KantorPredictionResult {
  prediksi_kwh_kantor: number;
}

export interface BulkPredictionResult {
  tanggal: string;
  prediksi_pax: number;
  prediksi_kwh_terminal: number;
  prediksi_kwh_kantor: number;
}

export interface BulkPredictionInput {
  tanggal: string;
  suhu_rata: number;
  suhu_max: number;
}

class MachineLearningService {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.ML_API_BASE_URL ?? 'http://127.0.0.1:8000';
  }

  /**
   * Memanggil endpoint /evaluate pada API Python.
   */
  public async evaluateDailyUsage(data: EvaluationInput): Promise<EvaluationResult> {
    try {
      const response = await axios.post<EvaluationResult>(`${this.baseURL}/evaluate`, data);
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status ?? 'N/A';
        const responseData = error.response?.data;
        let detailMessage = 'Tidak ada detail tambahan.';

        if (responseData?.detail) {
          detailMessage = JSON.stringify(responseData.detail);
        } else if (responseData) {
          detailMessage = JSON.stringify(responseData);
        }
        throw new Error(
          `Gagal memanggil API evaluasi ML. Status: ${status}. Detail: ${detailMessage}`,
        );
      }
      throw error;
    }
  }

  /**
   * BARU: Memanggil endpoint /evaluate/terminal pada API Python.
   */
  public async evaluateTerminalUsage(
    data: EvaluationInputTerminal,
  ): Promise<TerminalEvaluationResult> {
    try {
      const response = await axios.post<TerminalEvaluationResult>(
        `${this.baseURL}/evaluate/terminal`,
        data,
      );
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status ?? 'N/A';
        const responseData = error.response?.data;
        throw new Error(
          `Gagal memanggil API evaluasi terminal. Status: ${status}. Detail: ${JSON.stringify(
            responseData,
          )}`,
        );
      }
      throw error;
    }
  }

  /**
   * BARU: Memanggil endpoint /evaluate/kantor pada API Python.
   */
  public async evaluateKantorUsage(data: EvaluationInputKantor): Promise<KantorEvaluationResult> {
    try {
      const response = await axios.post<KantorEvaluationResult>(
        `${this.baseURL}/evaluate/kantor`,
        data,
      );
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status ?? 'N/A';
        const responseData = error.response?.data;
        throw new Error(
          `Gagal memanggil API evaluasi kantor. Status: ${status}. Detail: ${JSON.stringify(
            responseData,
          )}`,
        );
      }
      throw error;
    }
  }

  /**
   * Memanggil endpoint /predict pada API Python dengan data cuaca dari OpenWeatherMap.
   * @param date - Tanggal prediksi (objek Date).
   * @param weatherData - (Opsional) Data cuaca yang sudah ada untuk menghindari panggilan API baru.
   */
  public async getDailyPrediction(
    date: Date,
    weatherData?: { suhu_rata: number; suhu_max: number },
  ): Promise<PredictionResult> {
    try {
      let suhu_rata = weatherData?.suhu_rata;
      let suhu_max = weatherData?.suhu_max;

      if (suhu_rata === undefined || suhu_max === undefined) {
        const serviceForecast = await weatherService.getForecast(date);

        if (serviceForecast) {
          suhu_rata = serviceForecast.avg_temp ?? 28.0;
          suhu_max = serviceForecast.max_temp ?? 32.0;
        }
      }

      const finalSuhuRata = suhu_rata ?? 28.0;
      const finalSuhuMax = suhu_max ?? 32.0;

      const dateString = date.toISOString().split('T')[0];

      const response = await axios.post<PredictionResult>(`${this.baseURL}/predict`, {
        tanggal: dateString,
        suhu_rata: finalSuhuRata,
        suhu_max: finalSuhuMax,
      });
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status ?? 'N/A';
        const responseData = error.response?.data;
        let detailMessage = 'Tidak ada detail tambahan.';

        if (responseData?.detail) {
          detailMessage = JSON.stringify(responseData.detail);
        } else if (responseData) {
          detailMessage = JSON.stringify(responseData);
        }
        throw new Error(
          `Gagal memanggil API prediksi ML. Status: ${status}. Detail: ${detailMessage}`,
        );
      }
      throw error;
    }
  }

  /**
   * BARU: Memanggil endpoint /predict/terminal pada API Python.
   * @param date - Tanggal prediksi (objek Date).
   */
  public async getTerminalPrediction(
    date: Date,
    weatherData: { suhu_rata: number; suhu_max: number },
  ): Promise<TerminalPredictionResult> {
    try {
      const dateString = date.toISOString().split('T')[0];

      const response = await axios.post<TerminalPredictionResult>(
        `${this.baseURL}/predict/terminal`,
        {
          tanggal: dateString,
          suhu_rata: weatherData.suhu_rata,
          suhu_max: weatherData.suhu_max,
        },
      );
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status ?? 'N/A';
        const responseData = error.response?.data;
        throw new Error(
          `Gagal memanggil API prediksi terminal. Status: ${status}. Detail: ${JSON.stringify(
            responseData,
          )}`,
        );
      }
      throw error;
    }
  }

  /**
   * BARU: Memanggil endpoint /predict/kantor pada API Python.
   * @param date - Tanggal prediksi (objek Date).
   */
  public async getKantorPrediction(
    date: Date,
    weatherData: { suhu_rata: number; suhu_max: number },
  ): Promise<KantorPredictionResult> {
    try {
      const dateString = date.toISOString().split('T')[0];

      const response = await axios.post<KantorPredictionResult>(`${this.baseURL}/predict/kantor`, {
        tanggal: dateString,
        suhu_rata: weatherData.suhu_rata,
        suhu_max: weatherData.suhu_max,
      });
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status ?? 'N/A';
        const responseData = error.response?.data;
        throw new Error(
          `Gagal memanggil API prediksi kantor. Status: ${status}. Detail: ${JSON.stringify(
            responseData,
          )}`,
        );
      }
      throw error;
    }
  }

  public async getBulkPrediction(payload: BulkPredictionInput[]): Promise<BulkPredictionResult[]> {
    try {
      if (!payload || payload.length === 0) {
        return [];
      }

      const response = await axios.post<BulkPredictionResult[]>('/predict/bulk', payload);

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('ML Bulk Error Status:', error.response?.status);
        console.error('ML Bulk Error Data:', error.response?.data);
        throw new Error(`Gagal prediksi bulk: ${error.response?.data?.detail ?? error.message}`);
      }
      throw error;
    }
  }
}

export const machineLearningService = new MachineLearningService();
