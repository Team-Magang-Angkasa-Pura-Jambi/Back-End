import axios, { isAxiosError } from 'axios';
import { Error400, Error500 } from '../utils/customError.js';
import prisma from '../configs/db.js';
import { weatherConfig } from '../configs/weather.js';

type WeatherData = {
  suhu_rata: number;
  suhu_max: number;
};

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
   * Mengambil data prakiraan suhu rata-rata dan maksimal untuk tanggal tertentu.
   * @param date - Tanggal prakiraan yang diinginkan.
   */
  public async getForecast(date: Date): Promise<WeatherData | null> {
    if (!this.apiKey) {
      console.warn('Layanan cuaca tidak terkonfigurasi, mengembalikan null.');
      return null;
    }

    const targetDate = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );

    const cachedWeather = await prisma.weatherHistory.findUnique({
      where: { data_date: targetDate },
    });

    if (cachedWeather) {
      console.log(
        `[WeatherService] Data cuaca untuk ${targetDate.toISOString().split('T')[0]} ditemukan di cache.`
      );
      return {
        suhu_rata: cachedWeather.avg_temp.toNumber(),
        suhu_max: cachedWeather.max_temp.toNumber(),
      };
    }

    try {
      const response = await axios.get(this.baseURL, {
        params: {
          lat: this.lat,
          lon: this.lon,
          appid: this.apiKey,
          units: 'metric',
        },
      });

      const targetDateString = targetDate.toISOString().split('T')[0];

      const dailyForecasts = response.data.list.filter((item: any) => {
        return item.dt_txt.startsWith(targetDateString);
      });

      if (dailyForecasts.length === 0) {
        console.warn(
          `[WeatherService] Tidak ada data prakiraan cuaca yang ditemukan untuk tanggal ${targetDateString} dari API.`
        );

        return null;
      }
      

      

      let tempSum = 0;
      let maxTemp = -Infinity;

      for (const forecast of dailyForecasts) {
        tempSum += forecast.main.temp;
        if (forecast.main.temp_max > maxTemp) {
          maxTemp = forecast.main.temp_max;
        }
      }

      const avgTemp = tempSum / dailyForecasts.length;

      const parsedData = {
        suhu_rata: parseFloat(avgTemp.toFixed(2)),
        suhu_max: parseFloat(maxTemp.toFixed(2)),
      };

      await prisma.weatherHistory.create({
        data: {
          data_date: targetDate,
          avg_temp: parsedData.suhu_rata,
          max_temp: parsedData.suhu_max,
        },
      });
      console.log(
        `[WeatherService] Data cuaca untuk ${targetDate.toISOString().split('T')[0]} diambil dari API dan disimpan ke cache.`
      );

      return parsedData;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        console.error(
          `[WeatherService] Gagal mengambil data dari OpenWeatherMap. Status: ${status}, Pesan: "${message}"`
        );
        console.error(`[WeatherService] URL: ${error.config?.url}`);
        console.error(`[WeatherService] Params:`, error.config?.params);

        if (status === 401) {
          throw new Error500('Kunci API untuk layanan cuaca tidak valid.');
        }
        if (status === 400) {
          throw new Error400(
            `Permintaan ke layanan cuaca tidak valid: ${message}`
          );
        }
      }

      throw new Error500('Gagal terhubung ke layanan prakiraan cuaca.');
    }
  }
}

export const weatherService = new WeatherService();
