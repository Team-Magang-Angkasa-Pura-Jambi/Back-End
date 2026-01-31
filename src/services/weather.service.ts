import axios, { isAxiosError } from 'axios';
import { Error400, Error500 } from '../utils/customError.js';
import prisma from '../configs/db.js';
import { weatherConfig } from '../configs/weather.js';

interface WeatherData {
  suhu_rata: number;
  suhu_max: number;
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

    const targetDateStr = date.toISOString().split('T')[0];
    const targetDateObj = new Date(targetDateStr);

    const cachedWeather = await prisma.weatherHistory.findUnique({
      where: { data_date: targetDateObj },
    });

    if (cachedWeather) {
      return {
        suhu_rata: cachedWeather.avg_temp.toNumber(),
        suhu_max: cachedWeather.max_temp.toNumber(),
      };
    }

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
        console.log(`[WeatherService] Berhasil menyimpan cache untuk ${dbPayload.length} hari.`);
      }

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
      return null;
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
