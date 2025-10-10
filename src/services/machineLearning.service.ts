// src/services/machineLearning.service.ts

import axios from 'axios';
import type { UsageCategory } from '../generated/prisma/index.js';

// --- Tipe Data untuk Interaksi dengan ML API ---

interface PredictionPayload {
  tanggal: string; // YYYY-MM-DD
}

export interface PredictionResult {
  tanggal_prediksi: string;
  prediksi_listrik_kwh: number;
  prediksi_pax: number;
  prediksi_air_m3: number;
}

interface ClassificationPayload {
  kwh_today: number;
  kwh_yesterday: number;
  pax_today: number;
  pax_yesterday: number;
}

export interface ClassificationResult {
  klasifikasi: UsageCategory;
  input_data: {
    perubahan_listrik_kwh: number;
    perubahan_pax: number;
  };
}

// URL tempat Python API Anda berjalan (sebaiknya dari .env)
const ML_API_BASE_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';

/**
 * Service untuk berinteraksi dengan API Machine Learning eksternal (Python).
 */
export class MachineLearningService {
  /**
   * Memanggil endpoint /predict untuk mendapatkan prediksi konsumsi harian.
   * @param date - Tanggal dalam format YYYY-MM-DD.
   */
  public async getDailyPrediction(
    date: string
  ): Promise<PredictionResult | null> {
    console.log(`[ML Service] Meminta prediksi untuk tanggal: ${date}...`);
    try {
      const response = await axios.post<PredictionResult>(
        `${ML_API_BASE_URL}/predict`,
        { tanggal: date }
      );
      console.log('[ML Service] Prediksi berhasil diterima.');
      return response.data;
    } catch (error) {
      this.handleError(error, 'getDailyPrediction');
      return null;
    }
  }

  /**
   * Memanggil endpoint /classify untuk mendapatkan klasifikasi pemakaian.
   */
  public async classifyDailyUsage(
    payload: ClassificationPayload
  ): Promise<ClassificationResult | null> {
    console.log('[ML Service] Meminta klasifikasi pemakaian...', payload);
    try {
      // PERBAIKAN: Gunakan tipe `any` untuk menangani respons error dari Python.
      const response = await axios.post<
        ClassificationResult | { error: string }
      >(`${ML_API_BASE_URL}/classify`, payload);

      // PERBAIKAN: Cek apakah respons dari ML API berisi error.
      if ('error' in response.data) {
        this.handleError(response.data.error, 'classifyDailyUsage');
        return null;
      }

      console.log(
        `[ML Service] Klasifikasi diterima: ${response.data.klasifikasi}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'classifyDailyUsage');
      return null;
    }
  }

  private handleError(error: unknown, context: string) {
    if (axios.isAxiosError(error)) {
      console.error(
        `[ML Service - ${context}] Error saat memanggil ML API:`,
        error.response?.data || error.message
      );
    } else {
      console.error(
        `[ML Service - ${context}] Terjadi error yang tidak terduga:`,
        error
      );
    }
  }
}

export const machineLearningService = new MachineLearningService();
