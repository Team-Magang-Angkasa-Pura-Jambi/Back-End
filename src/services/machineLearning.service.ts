import axios, { isAxiosError } from 'axios';
import { weatherService } from './weather.service.js';

// PERBAIKAN: Tipe disesuaikan dengan kontrak API baru
type EvaluationInput = {
  pax: number;
  suhu_rata: number;
  suhu_max: number;
  is_hari_kerja: number;
  aktual_kwh_terminal: number;
  aktual_kwh_kantor: number;
};

type EvaluationResult = {
  kinerja_terminal: string;
  deviasi_persen_terminal: number;
  kinerja_kantor: string;
  deviasi_persen_kantor: number;
};

// BARU: Tipe input untuk evaluasi spesifik per meter
type EvaluationInputTerminal = {
  pax: number;
  suhu_rata: number;
  suhu_max: number;
  aktual_kwh_terminal: number;
};

type EvaluationInputKantor = {
  suhu_rata: number;
  suhu_max: number;
  is_hari_kerja: number;
  aktual_kwh_kantor: number;
};

type TerminalEvaluationResult = {
  kinerja_terminal: string;
  deviasi_persen_terminal: number;
};

type KantorEvaluationResult = {
  kinerja_kantor: string;
  deviasi_persen_kantor: number;
};

type PredictionResult = {
  prediksi_pax: number; // BARU: API sekarang mengembalikan prediksi pax juga
  prediksi_kwh_terminal: number;
  prediksi_kwh_kantor: number; // Nama properti ini mungkin perlu disesuaikan
};

// BARU: Tipe untuk hasil prediksi spesifik
type TerminalPredictionResult = {
  prediksi_kwh_terminal: number;
};

// BARU: Tipe untuk hasil prediksi spesifik
type KantorPredictionResult = {
  prediksi_kwh_kantor: number;
};

class MachineLearningService {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.ML_API_BASE_URL || 'http://127.0.0.1:8000';
  }

  /**
   * Memanggil endpoint /evaluate pada API Python.
   */
  public async evaluateDailyUsage(
    data: EvaluationInput
  ): Promise<EvaluationResult> {
    try {
      const response = await axios.post<EvaluationResult>(
        `${this.baseURL}/evaluate`,
        data
      );
      return response.data;
    } catch (error) {
      // PERBAIKAN: Tangani error Axios dan buat pesan yang lebih informatif.
      if (isAxiosError(error)) {
        const status = error.response?.status || 'N/A';
        const responseData = error.response?.data;
        let detailMessage = 'Tidak ada detail tambahan.';

        // FastAPI 422 error biasanya memiliki detail di `response.data.detail`
        if (responseData && responseData.detail) {
          detailMessage = JSON.stringify(responseData.detail);
        } else if (responseData) {
          detailMessage = JSON.stringify(responseData);
        }
        throw new Error(
          `Gagal memanggil API evaluasi ML. Status: ${status}. Detail: ${detailMessage}`
        );
      }
      throw error; // Lempar kembali error lain yang tidak terduga
    }
  }

  /**
   * BARU: Memanggil endpoint /evaluate/terminal pada API Python.
   */
  public async evaluateTerminalUsage(
    data: EvaluationInputTerminal
  ): Promise<TerminalEvaluationResult> {
    try {
      const response = await axios.post<TerminalEvaluationResult>(
        `${this.baseURL}/evaluate/terminal`,
        data
      );
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status || 'N/A';
        const responseData = error.response?.data;
        throw new Error(
          `Gagal memanggil API evaluasi terminal. Status: ${status}. Detail: ${JSON.stringify(
            responseData
          )}`
        );
      }
      throw error;
    }
  }

  /**
   * BARU: Memanggil endpoint /evaluate/kantor pada API Python.
   */
  public async evaluateKantorUsage(
    data: EvaluationInputKantor
  ): Promise<KantorEvaluationResult> {
    try {
      const response = await axios.post<KantorEvaluationResult>(
        `${this.baseURL}/evaluate/kantor`,
        data
      );
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status || 'N/A';
        const responseData = error.response?.data;
        throw new Error(
          `Gagal memanggil API evaluasi kantor. Status: ${status}. Detail: ${JSON.stringify(
            responseData
          )}`
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
    weatherData?: { suhu_rata: number; suhu_max: number }
  ): Promise<PredictionResult> {
    try {
      // PERBAIKAN: Panggil weatherService jika data cuaca tidak disediakan.
      let finalWeatherData = weatherData;
      if (!finalWeatherData) {
        // Panggil API cuaca untuk mendapatkan data prakiraan.
        finalWeatherData = await weatherService.getForecast(date);
      }

      // Gunakan data cuaca yang didapat, atau fallback ke nilai default jika API gagal.
      const suhu_rata = finalWeatherData?.suhu_rata ?? 28.0; // Nilai default jika null
      const suhu_max = finalWeatherData?.suhu_max ?? 32.0; // Nilai default jika null

      // Kirim 'tanggal' dalam format YYYY-MM-DD, bukan 'pax'.
      const dateString = date.toISOString().split('T')[0];

      const response = await axios.post<PredictionResult>(
        `${this.baseURL}/predict`,
        {
          tanggal: dateString,
          suhu_rata: suhu_rata,
          suhu_max: suhu_max,
        }
      );
      return response.data;
    } catch (error) {
      // PERBAIKAN: Tangani error Axios juga untuk endpoint prediksi.
      if (isAxiosError(error)) {
        const status = error.response?.status || 'N/A';
        const responseData = error.response?.data;
        let detailMessage = 'Tidak ada detail tambahan.';

        if (responseData && responseData.detail) {
          detailMessage = JSON.stringify(responseData.detail);
        } else if (responseData) {
          detailMessage = JSON.stringify(responseData);
        }
        throw new Error(
          `Gagal memanggil API prediksi ML. Status: ${status}. Detail: ${detailMessage}`
        );
      }
      throw error; // Lempar kembali error lain yang tidak terduga
    }
  }

  /**
   * BARU: Memanggil endpoint /predict/terminal pada API Python.
   * @param date - Tanggal prediksi (objek Date).
   */
  public async getTerminalPrediction(
    date: Date,
    weatherData: { suhu_rata: number; suhu_max: number }
  ): Promise<TerminalPredictionResult> {
    try {
      const dateString = date.toISOString().split('T')[0];

      const response = await axios.post<TerminalPredictionResult>(
        `${this.baseURL}/predict/terminal`,
        {
          tanggal: dateString,
          suhu_rata: weatherData.suhu_rata,
          suhu_max: weatherData.suhu_max,
        }
      );
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status || 'N/A';
        const responseData = error.response?.data;
        throw new Error(
          `Gagal memanggil API prediksi terminal. Status: ${status}. Detail: ${JSON.stringify(
            responseData
          )}`
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
    weatherData: { suhu_rata: number; suhu_max: number }
  ): Promise<KantorPredictionResult> {
    try {
      const dateString = date.toISOString().split('T')[0];

      const response = await axios.post<KantorPredictionResult>(
        `${this.baseURL}/predict/kantor`,
        {
          tanggal: dateString,
          suhu_rata: weatherData.suhu_rata,
          suhu_max: weatherData.suhu_max,
        }
      );
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status || 'N/A';
        const responseData = error.response?.data;
        throw new Error(
          `Gagal memanggil API prediksi kantor. Status: ${status}. Detail: ${JSON.stringify(
            responseData
          )}`
        );
      }
      throw error;
    }
  }
}

export const machineLearningService = new MachineLearningService();
