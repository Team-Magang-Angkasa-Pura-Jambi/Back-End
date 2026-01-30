import prisma from '../../configs/db.js';
import { Error400, Error401, Error404 } from '../../utils/customError.js';
import { _saveClassification } from '../metering/helpers/forecast-calculator.js';
import { machineLearningService } from './machineLearning.service.js';

const ensureDataExists = <T>(data: T | null | undefined, name: string, date: Date): T => {
  if (!data) throw new Error404(`Missing ${name} Data for ${new Date(date).toDateString()}`);
  return data;
};

export const classifyTerminal = async (date: Date, meterId: number) => {
  try {
    const [aktualKwhData, paxData, weatherData] = await Promise.all([
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

    const validKwh = ensureDataExists(aktualKwhData, 'KWH', date);
    const validPax = ensureDataExists(paxData, 'Pax', date);
    const validWeather = ensureDataExists(weatherData, 'Weather', date);

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
      throw error;
    } else {
      throw new Error('Internal Server Error processing Terminal Classification');
    }
  }
};

export const classifyOffice = async (date: Date, meterId: number) => {
  try {
    const [aktualKwhData, weatherData] = await Promise.all([
      prisma.dailySummary.findFirst({
        where: { summary_date: date, meter_id: meterId },
      }),
      prisma.weatherHistory.findFirst({
        where: { data_date: date },
        select: { avg_temp: true, max_temp: true },
      }),
    ]);

    const dayOfWeek = new Date(date).getUTCDay();
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5 ? 1 : 0;

    const validKwh = ensureDataExists(aktualKwhData, 'KWH', date);
    const validWeather = ensureDataExists(weatherData, 'Weather', date);

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
