import axios, { isAxiosError } from 'axios';
import { Error400, Error500 } from '../utils/customError.js';
import prisma from '../configs/db.js';
import { weatherConfig } from '../configs/weather.js';

interface WeatherData {
  suhu_rata: number;
  suhu_max: number;
  is_estimated?: boolean;
}

interface DailyAccumulator {
  tempSum: number;
  maxTemp: number;
  count: number;
}

class WeatherService {
  private apiKey: string;
  private lat: string;
  private lon: string;
  private baseURL: string;

  constructor() {
    this.apiKey = weatherConfig.apiKey;
    this.lat = weatherConfig.latitude;
    this.lon = weatherConfig.longitude;
    this.baseURL = weatherConfig.baseURL;
  }

  /**
   * Mengambil data prakiraan.
   * Strategi: Cek DB -> Jika null, Fetch API -> Hitung SEMUA tanggal di API -> Simpan SEMUA ke DB -> Return tanggal diminta.
   */
  public async getForecast(date: Date): Promise<WeatherData | null> {
    if (!this.apiKey) return null;

    // Gunakan Local Date agar tanggal tidak mundur karena timezone UTC
    const targetDateStr = date.toLocaleDateString('en-CA');
    const targetDateObj = new Date(targetDateStr);

    // 1. CEK DATABASE (Prioritas Utama)
    const cachedWeather = await prisma.weatherHistory.findUnique({
      where: { data_date: targetDateObj },
    });

    if (cachedWeather) {
      return {
        suhu_rata: cachedWeather.avg_temp.toNumber(),
        suhu_max: cachedWeather.max_temp.toNumber(),
      };
    }

    // 2. LOGIC GUARD: Handling Tanggal
    const today = new Date();
    const normalizeDate = (d: Date) => new Date(d.toLocaleDateString('en-CA'));

    const reqDateNorm = normalizeDate(date);
    const todayNorm = normalizeDate(today);

    // --- PERBAIKAN UTAMA DISINI ---
    // Jika tanggal adalah MASA LALU dan tidak ada di DB:
    if (reqDateNorm < todayNorm) {
      console.warn(
        `[WeatherService] Tanggal ${targetDateStr} adalah masa lalu & tidak ada di DB. API Forecast tidak support history.`,
      );

      // SOLUSI: Return NILAI DEFAULT / RATA-RATA (Hardcode atau estimasi)
      // Agar sistem klasifikasi TIDAK Error 404.
      // Anda bisa sesuaikan angka ini dengan rata-rata suhu lokasi Anda.
      return {
        suhu_rata: 28.0, // Suhu rata-rata aman (misal Indonesia)
        suhu_max: 32.0, // Suhu max rata-rata aman
        is_estimated: true, // (Opsional) Flag penanda data palsu
      };
    }

    // Jika tanggal KEJAUHAN (lebih dari 5 hari kedepan)
    const maxForecastDate = new Date();
    maxForecastDate.setDate(today.getDate() + 5);
    const maxDateNorm = normalizeDate(maxForecastDate);

    if (reqDateNorm > maxDateNorm) {
      console.warn(`[WeatherService] Tanggal ${targetDateStr} terlalu jauh untuk forecast.`);
      return null; // Kalau masa depan kejauhan, lebih baik null/tunggu mendekati hari H
    }

    // 3. AMBIL DARI API (Hanya untuk Hari Ini & Masa Depan)
    try {
      console.log(`[WeatherService] Cache miss untuk ${targetDateStr}. Mengambil data API...`);

      const response = await axios.get(this.baseURL, {
        params: {
          lat: this.lat,
          lon: this.lon,
          appid: this.apiKey,
          units: 'metric',
        },
      });

      const forecastList = response.data.list;
      if (!forecastList || forecastList.length === 0) return null;

      const processedForecasts = this.aggregateForecastByDay(forecastList);

      // Simpan ke DB (Cache)
      const dbPayload = Array.from(processedForecasts.entries()).map(([dateStr, data]) => ({
        data_date: new Date(dateStr),
        avg_temp: data.suhu_rata,
        max_temp: data.suhu_max,
      }));

      if (dbPayload.length > 0) {
        await prisma.weatherHistory.createMany({
          data: dbPayload,
          skipDuplicates: true,
        });
      }

      // Cek apakah tanggal target ada di hasil API
      const result = processedForecasts.get(targetDateStr);

      if (!result) {
        // Fallback jika API sukses tapi tanggal spesifik hari ini belum masuk list (jarang terjadi)
        console.warn(`[WeatherService] API sukses, tapi tanggal ${targetDateStr} belum tersedia.`);
        // Return default agar tidak crash
        return { suhu_rata: 28.0, suhu_max: 32.0 };
      }

      return result;
    } catch (error) {
      return this.handleAxiosError(error);
    }
  }

  /**
   * Helper: Mengubah data per 3 jam (raw API) menjadi data harian (avg & max)
   */
  private aggregateForecastByDay(list: any[]): Map<string, WeatherData> {
    const dailyMap = new Map<string, DailyAccumulator>();

    for (const item of list) {
      const dateStr = item.dt_txt.split(' ')[0];
      const temp = item.main.temp;
      const max = item.main.temp_max;

      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { tempSum: 0, maxTemp: -Infinity, count: 0 });
      }

      const entry = dailyMap.get(dateStr)!;
      entry.tempSum += temp;
      entry.maxTemp = Math.max(entry.maxTemp, max);
      entry.count += 1;
    }

    const finalMap = new Map<string, WeatherData>();
    dailyMap.forEach((val, key) => {
      finalMap.set(key, {
        suhu_rata: parseFloat((val.tempSum / val.count).toFixed(2)),
        suhu_max: parseFloat(val.maxTemp.toFixed(2)),
      });
    });

    return finalMap;
  }

  /**
   * Helper: Centralized Error Handling
   */
  private handleAxiosError(error: unknown): never {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message ?? error.message;

      console.error(`[WeatherService] Error ${status}: ${message}`);

      if (status === 401) throw new Error500('API Key Weather invalid.');
      if (status === 400) throw new Error400(`Bad Request: ${message}`);
    }
    throw new Error500('Gagal terhubung ke layanan cuaca.');
  }
}

export const weatherService = new WeatherService();
