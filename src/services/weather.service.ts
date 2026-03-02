import axios from 'axios';
import { Error500 } from '../utils/customError.js';
import prisma from '../configs/db.js';
import { weatherConfig } from '../configs/weather.js';

interface WeatherData {
  suhu_rata: number;
  suhu_max: number;
  is_estimated?: boolean;
}

class WeatherService {
  private apiKey: string;
  private lat: string;
  private lon: string;
  private forecastURL: string;
  private historyURL = 'https://archive-api.open-meteo.com/v1/archive';

  constructor() {
    this.apiKey = weatherConfig.apiKey;
    this.lat = weatherConfig.latitude;
    this.lon = weatherConfig.longitude;
    this.forecastURL = weatherConfig.baseURL;
  }

  /**
   * Mengambil data cuaca harian (History atau Forecast)
   */
  public async getWeatherData(date: Date): Promise<WeatherData | null> {
    const targetDateStr = date.toLocaleDateString('en-CA');
    const targetDateObj = new Date(targetDateStr);

    // 1. CEK DATABASE (Cache)
    const cachedWeather = await prisma.weatherHistory.findUnique({
      where: { data_date: targetDateObj },
    });

    if (cachedWeather) {
      return {
        suhu_rata: cachedWeather.avg_temp.toNumber(),
        suhu_max: cachedWeather.max_temp.toNumber(),
      };
    }

    // 2. TENTUKAN SUMBER API
    const today = new Date();
    const normalizeDate = (d: Date) => new Date(d.toLocaleDateString('en-CA'));

    const reqDateNorm = normalizeDate(date);
    const todayNorm = normalizeDate(today);

    if (reqDateNorm < todayNorm) {
      return await this.fetchHistoryFromOpenMeteo(targetDateStr);
    } else {
      return await this.fetchForecastFromOpenWeather(date);
    }
  }

  private async fetchHistoryFromOpenMeteo(dateStr: string): Promise<WeatherData | null> {
    try {
      const response = await axios.get(this.historyURL, {
        params: {
          latitude: this.lat,
          longitude: this.lon,
          start_date: dateStr,
          end_date: dateStr,
          daily: 'temperature_2m_max,temperature_2m_mean',
          timezone: 'Asia/Jakarta',
        },
      });

      const daily = response.data.daily;
      if (!daily?.time.length) return null;

      const result = {
        suhu_rata: parseFloat(daily.temperature_2m_mean[0].toFixed(2)),
        suhu_max: parseFloat(daily.temperature_2m_max[0].toFixed(2)),
      };

      await prisma.weatherHistory.create({
        data: {
          data_date: new Date(dateStr),
          avg_temp: result.suhu_rata,
          max_temp: result.suhu_max,
        },
      });

      return result;
    } catch (error) {
      console.error('[WeatherService] History Error:', error);
      return { suhu_rata: 28.0, suhu_max: 32.0, is_estimated: true };
    }
  }

  private async fetchForecastFromOpenWeather(date: Date): Promise<WeatherData | null> {
    const targetDateStr = date.toLocaleDateString('en-CA');
    try {
      const response = await axios.get(this.forecastURL, {
        params: { lat: this.lat, lon: this.lon, appid: this.apiKey, units: 'metric' },
      });

      const forecastList = response.data.list;
      if (!forecastList) return null;

      // Logika aggregasi (sama seperti kode lamamu)
      const dailyMap = new Map<string, { sum: number; max: number; count: number }>();
      for (const item of forecastList) {
        const dStr = item.dt_txt.split(' ')[0];
        if (!dailyMap.has(dStr)) dailyMap.set(dStr, { sum: 0, max: -Infinity, count: 0 });
        const entry = dailyMap.get(dStr)!;
        entry.sum += item.main.temp;
        entry.max = Math.max(entry.max, item.main.temp_max);
        entry.count++;
      }

      // Simpan semua ke DB (Bulk)
      const payload = Array.from(dailyMap.entries()).map(([d, val]) => ({
        data_date: new Date(d),
        avg_temp: parseFloat((val.sum / val.count).toFixed(2)),
        max_temp: parseFloat(val.max.toFixed(2)),
      }));

      await prisma.weatherHistory.createMany({ data: payload, skipDuplicates: true });

      const target = dailyMap.get(targetDateStr);
      return target
        ? {
            suhu_rata: parseFloat((target.sum / target.count).toFixed(2)),
            suhu_max: target.max,
          }
        : null;
    } catch (error) {
      throw new Error500('Gagal mengambil ramalan cuaca.');
    }
  }
}

export const weatherService = new WeatherService();
