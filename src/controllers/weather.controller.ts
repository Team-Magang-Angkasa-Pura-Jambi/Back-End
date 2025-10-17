import { type Request, type Response } from 'express';
import { weatherService } from '../services/weather.service.js';
import { res200 } from '../utils/response.js';
import { Error404 } from '../utils/customError.js';

export class WeatherController {
  async getTodayWeather(req: Request, res: Response) {
    // Menggunakan new Date() untuk mendapatkan tanggal hari ini.
    // weatherService.getForecast sudah menangani caching dan panggilan API.
    const weatherData = await weatherService.getForecast(new Date());

    if (!weatherData) {
      throw new Error404('Data cuaca untuk hari ini tidak tersedia.');
    }

    res200({
      res,
      message: 'Data cuaca hari ini berhasil diambil.',
      data: weatherData,
    });
  }
}

export const weatherController = new WeatherController();
