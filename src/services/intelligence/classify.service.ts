import prisma from '../../configs/db.js';
import { Error400, Error401, Error404 } from '../../utils/customError.js';
import { _saveClassification } from '../metering/helpers/forecast-calculator.js';
import { weatherService } from '../weather.service.js';
import { machineLearningService } from './machineLearning.service.js';

const ensureDataExists = <T>(data: T | null | undefined, name: string, date: Date): T => {
  if (!data) throw new Error404(`Missing ${name} Data for ${new Date(date).toDateString()}`);
  return data;
};

const toDecimalLike = (val: number) => ({
  toNumber: () => val,
});

export const classifyTerminal = async (date: Date, meterId: number) => {
  try {
    const [aktualKwhData, paxData, dbWeatherData] = await Promise.all([
      prisma.dailySummary.findFirst({
        where: { summary_date: date, meter_id: meterId },
        select: {
          summary_id: true,
          summary_date: true,
          total_consumption: true,
          total_cost: true,
          meter_id: true,
        },
      }),
      prisma.paxData.findFirst({
        where: { data_date: date },
        select: { total_pax: true },
      }),
      prisma.weatherHistory.findFirst({
        where: { data_date: date },
        select: { avg_temp: true, max_temp: true },
      }),
    ]);

    let weatherData = dbWeatherData;

    if (!weatherData) {
      console.log(
        `[Classify] Data cuaca DB kosong untuk ${date.toDateString()}, mengambil dari API...`,
      );

      const apiWeather = await weatherService.getForecast(date);

      if (apiWeather) {
        weatherData = {
          avg_temp: toDecimalLike(apiWeather.suhu_rata) as any,
          max_temp: toDecimalLike(apiWeather.suhu_max) as any,
        };
      }
    }

    const validKwh = ensureDataExists(aktualKwhData, 'KWH', date);
    const validPax = ensureDataExists(paxData, 'Pax', date);
    const validWeather = ensureDataExists(weatherData, 'Weather (DB & API Failed)', date);

    const mlPayload = {
      pax: validPax.total_pax,
      suhu_rata: validWeather.avg_temp.toNumber(),
      suhu_max: validWeather.max_temp.toNumber(),
      aktual_kwh_terminal: validKwh.total_consumption?.toNumber() ?? 0,
    };

    const result = await machineLearningService.evaluateTerminalUsage(mlPayload);
    const modelVersion = 'v1.3';

    if (result) {
      await _saveClassification(
        validKwh,
        result.kinerja_terminal,
        result.deviasi_persen_terminal,
        modelVersion,
      );
    }

    return result;
  } catch (error) {
    console.error('Error in classifyTerminal:', error);
    if (error instanceof Error400 || error instanceof Error401 || error instanceof Error404) {
      console.warn(`⚠️ Data tidak ditemukan (404). Melanjutkan proses ke item berikutnya...`);

      // Return null agar fungsi pemanggil tahu bahwa data ini kosong, tapi tidak error
      return;
    } else {
      throw new Error('Internal Server Error processing Terminal Classification');
    }
  }
};

export const classifyOffice = async (date: Date, meterId: number) => {
  try {
    const [aktualKwhData, dbWeatherData] = await Promise.all([
      prisma.dailySummary.findFirst({
        where: { summary_date: date, meter_id: meterId },
      }),
      prisma.weatherHistory.findFirst({
        where: { data_date: date },
        select: { avg_temp: true, max_temp: true },
      }),
    ]);

    let weatherData = dbWeatherData;

    if (!weatherData) {
      console.log(
        `[Classify] Data cuaca DB kosong untuk ${date.toDateString()}, mengambil dari API...`,
      );

      const apiWeather = await weatherService.getForecast(date);

      if (apiWeather) {
        weatherData = {
          avg_temp: toDecimalLike(apiWeather.suhu_rata) as any,
          max_temp: toDecimalLike(apiWeather.suhu_max) as any,
        };
      }
    }

    const dayOfWeek = new Date(date).getUTCDay();
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5 ? 1 : 0;

    const validKwh = ensureDataExists(aktualKwhData, 'KWH', date);
    const validWeather = ensureDataExists(weatherData, 'Weather (DB & API Failed)', date);

    const mlPayload = {
      is_hari_kerja: isWorkday,
      suhu_rata: validWeather.avg_temp.toNumber(),
      suhu_max: validWeather.max_temp.toNumber(),
      aktual_kwh_kantor: validKwh.total_consumption?.toNumber() ?? 0,
    };

    const result = await machineLearningService.evaluateKantorUsage(mlPayload);
    const modelVersion = 'v1.3';

    if (result) {
      await _saveClassification(
        validKwh,
        result.kinerja_kantor,
        result.deviasi_persen_kantor,
        modelVersion,
      );
    }

    return result;
  } catch (error) {
    console.error('Error in classifyOffice:', error);
    if (error instanceof Error400 || error instanceof Error401 || error instanceof Error404) {
      throw error;
    } else {
      throw new Error('Internal Server Error processing Office Classification');
    }
  }
};

export const classifyService = async (date: Date, meterId: number) => {
  try {
    const meter = await prisma.meter.findUnique({
      where: { meter_id: meterId },
      include: {
        category: true,
      },
    });

    if (!meter) {
      throw new Error404(`Meter dengan ID ${meterId} tidak ditemukan.`);
    }

    const categoryName = meter.category?.name?.toLowerCase() || '';

    if (categoryName.includes('terminal')) {
      return await classifyTerminal(date, meterId);
    } else {
      return await classifyOffice(date, meterId);
    }
  } catch (error) {
    console.error('Error in classifyService:', error);
    if (error instanceof Error400 || error instanceof Error401 || error instanceof Error404) {
      console.warn(`⚠️ Data tidak ditemukan (404). Melanjutkan proses ke item berikutnya...`);

      // Return null agar fungsi pemanggil tahu bahwa data ini kosong, tapi tidak error
      return; 
    } else {
      throw new Error('Internal Server Error processing Classification Service');
    }
  }
};
