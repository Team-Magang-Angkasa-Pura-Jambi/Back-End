import axios, { isAxiosError } from 'axios';
import { Error400, Error500 } from '../utils/customError.js';
import prisma from '../configs/db.js';
import { weatherConfig } from '../configs/weather.js';

interface WeatherData {
  suhu_rata: number;
  suhu_max: number;
}

// Interface untuk helper grouping
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

    // Normalisasi tanggal ke YYYY-MM-DD untuk query DB & API filter
    const targetDateStr = date.toISOString().split('T')[0];
    const targetDateObj = new Date(targetDateStr); // Pastikan jam 00:00:00 UTC

    // 1. Cek Cache Database
    const cachedWeather = await prisma.weatherHistory.findUnique({
      where: { data_date: targetDateObj },
    });

    if (cachedWeather) {
      return {
        suhu_rata: cachedWeather.avg_temp.toNumber(),
        suhu_max: cachedWeather.max_temp.toNumber(),
      };
    }

    // 2. Jika tidak ada, ambil dari API (Fetch sekali, simpan banyak)
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

      // 3. Proses & Agregasi data untuk SEMUA hari yang tersedia di response
      // Output Map: "2023-10-01" -> { suhu_rata: 28, suhu_max: 32 }
      const processedForecasts = this.aggregateForecastByDay(forecastList);

      // 4. Bulk Insert ke Database (Optimasi Database)
      // Kita simpan semua hari yang didapat, bukan cuma targetDate
      const dbPayload = Array.from(processedForecasts.entries()).map(([dateStr, data]) => ({
        data_date: new Date(dateStr),
        avg_temp: data.suhu_rata,
        max_temp: data.suhu_max,
      }));

      if (dbPayload.length > 0) {
        await prisma.weatherHistory.createMany({
          data: dbPayload,
          skipDuplicates: true, // PENTING: Agar tidak error jika hari lain sudah ada di DB
        });
        console.log(`[WeatherService] Berhasil menyimpan cache untuk ${dbPayload.length} hari.`);
      }

      // 5. Kembalikan data untuk tanggal yang diminta user
      const result = processedForecasts.get(targetDateStr);

      if (!result) {
        console.warn(
          `[WeatherService] API merespons, tapi tanggal ${targetDateStr} tidak ada dalam list.`,
        );
        return null;
      }

      return result;
    } catch (error) {
      this.handleAxiosError(error);
      return null; // Unreachable karena handleAxiosError melempar throw
    }
  }

  /**
   * Helper: Mengubah data per 3 jam (raw API) menjadi data harian (avg & max)
   */
  private aggregateForecastByDay(list: any[]): Map<string, WeatherData> {
    const dailyMap = new Map<string, DailyAccumulator>();

    // Pass 1: Sum & Max Logic
    for (const item of list) {
      const dateStr = item.dt_txt.split(' ')[0]; // Ambil YYYY-MM-DD
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

    // Pass 2: Calculate Average & Format
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
