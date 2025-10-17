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

type PredictionResult = {
  prediksi_kwh_terminal: number;
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
   * Memanggil endpoint /predict pada API Python dengan data cuaca dari OpenWeatherMap.
   * @param date - Tanggal prediksi (objek Date).
   * @param pax - Prakiraan jumlah penumpang.
   * @param weatherData - (Opsional) Data cuaca yang sudah ada untuk menghindari panggilan API baru.
   */
  public async getDailyPrediction(
    date: Date,
    pax: number,
    weatherData?: { suhu_rata: number; suhu_max: number }
  ): Promise<PredictionResult> {
    try {
      // PERBAIKAN: Logika pengambilan cuaca dipindahkan ke pemanggil (misal: analysis.service).
      // Service ini sekarang hanya menerima data cuaca yang sudah jadi.

      // Jika layanan cuaca tidak tersedia, gunakan nilai default atau lempar error
      const suhu_rata = weatherData?.suhu_rata ?? 28.0; // Nilai default jika null
      const suhu_max = weatherData?.suhu_max ?? 32.0; // Nilai default jika null

      // 2. Panggil API Python dengan data yang sudah diperkaya
      const response = await axios.post<PredictionResult>(
        `${this.baseURL}/predict`,
        {
          pax: pax,
          suhu_rata: suhu_rata,
          suhu_max: suhu_max,
          is_hari_kerja: date.getUTCDay() >= 1 && date.getUTCDay() <= 5 ? 1 : 0,
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
}

export const machineLearningService = new MachineLearningService();
