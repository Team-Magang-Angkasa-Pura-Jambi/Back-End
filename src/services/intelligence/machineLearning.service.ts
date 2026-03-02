import axios, { isAxiosError } from 'axios';
import { weatherService } from '../weather.service.js';

// --- Interfaces Tetap Sama ---
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
   * Helper: Penanganan error yang tidak mematikan sistem.
   * Mengganti 'throw' dengan 'return null' agar service pemanggil bisa melakukan skip.
   */
  private handleWarning(error: unknown, context: string): null {
    if (isAxiosError(error)) {
      const status = error.response?.status ?? 'CONNECTION_ERROR';
      const detail = error.response?.data?.detail ?? error.message;

      console.warn(
        `[ML Service Warning - ${context}] Server ML tidak merespon/error (Status: ${status}).`,
      );
      console.warn(`Detail: ${JSON.stringify(detail)}`);
    } else {
      console.error(`[ML Service Critical] Unexpected Error:`, error);
    }
    return null; // Return null agar flow di service/controller tidak terhenti
  }

  // --- Evaluasi Kinerja (Graceful) ---

  public async evaluateDailyUsage(data: EvaluationInput): Promise<EvaluationResult | null> {
    try {
      const response = await axios.post<EvaluationResult>(`${this.baseURL}/evaluate`, data);
      return response.data;
    } catch (error) {
      return this.handleWarning(error, 'Evaluate Daily');
    }
  }

  public async evaluateTerminalUsage(
    data: EvaluationInputTerminal,
  ): Promise<TerminalEvaluationResult | null> {
    try {
      const response = await axios.post<TerminalEvaluationResult>(
        `${this.baseURL}/evaluate/terminal`,
        data,
      );
      return response.data;
    } catch (error) {
      return this.handleWarning(error, 'Evaluate Terminal');
    }
  }

  public async evaluateKantorUsage(
    data: EvaluationInputKantor,
  ): Promise<KantorEvaluationResult | null> {
    try {
      const response = await axios.post<KantorEvaluationResult>(
        `${this.baseURL}/evaluate/kantor`,
        data,
      );
      return response.data;
    } catch (error) {
      return this.handleWarning(error, 'Evaluate Kantor');
    }
  }

  // --- Prediksi Konsumsi (Graceful) ---

  public async getDailyPrediction(
    date: Date,
    weatherData?: { suhu_rata: number; suhu_max: number },
  ): Promise<PredictionResult | null> {
    try {
      let suhu_rata = weatherData?.suhu_rata;
      let suhu_max = weatherData?.suhu_max;

      if (suhu_rata === undefined || suhu_max === undefined) {
        const weather = await weatherService.getWeatherData(date);
        if (weather) {
          suhu_rata = weather.suhu_rata;
          suhu_max = weather.suhu_max;
        }
      }

      const response = await axios.post<PredictionResult>(`${this.baseURL}/predict`, {
        tanggal: date.toLocaleDateString('en-CA'),
        suhu_rata: suhu_rata ?? 28.0,
        suhu_max: suhu_max ?? 32.0,
      });
      return response.data;
    } catch (error) {
      return this.handleWarning(error, 'Daily Prediction');
    }
  }

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

  public async getTerminalPrediction(
    date: Date,
    weatherData: { suhu_rata: number; suhu_max: number },
  ): Promise<TerminalPredictionResult | null> {
    try {
      const response = await axios.post<TerminalPredictionResult>(
        `${this.baseURL}/predict/terminal`,
        {
          tanggal: date.toLocaleDateString('en-CA'),
          suhu_rata: weatherData.suhu_rata,
          suhu_max: weatherData.suhu_max,
        },
      );
      return response.data;
    } catch (error) {
      return this.handleWarning(error, 'Terminal Prediction');
    }
  }

  public async getBulkPrediction(payload: BulkPredictionInput[]): Promise<BulkPredictionResult[]> {
    try {
      if (!payload || payload.length === 0) return [];
      const response = await axios.post<BulkPredictionResult[]>(
        `${this.baseURL}/predict/bulk`,
        payload,
      );
      return response.data;
    } catch (error) {
      this.handleWarning(error, 'Bulk Prediction');
      return []; // Untuk bulk, kembalikan array kosong jika gagal
    }
  }
}

export const machineLearningService = new MachineLearningService();
