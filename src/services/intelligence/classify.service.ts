import prisma from '../../configs/db.js';
import { Error400, Error401, Error404 } from '../../utils/customError.js';
import { _saveClassification } from '../metering/helpers/forecast-calculator.js';
import { weatherService } from '../weather.service.js';
import { machineLearningService } from './machineLearning.service.js';

/**
 * Helper: Memastikan data ada, jika tidak lempar Error404
 */
const ensureDataExists = <T>(data: T | null | undefined, name: string, date: Date): T => {
  if (!data) throw new Error404(`Missing ${name} Data for ${date.toLocaleDateString('en-CA')}`);
  return data;
};

/**
 * Helper: Mengambil data cuaca dengan fallback API (Mendukung History & Forecast)
 */
const getEffectiveWeather = async (date: Date) => {
  // 1. Cek DB Terlebih dahulu
  const dbWeather = await prisma.weatherHistory.findFirst({
    where: { data_date: date },
    select: { avg_temp: true, max_temp: true },
  });

  if (dbWeather) {
    return {
      suhu_rata: dbWeather.avg_temp.toNumber(),
      suhu_max: dbWeather.max_temp.toNumber(),
    };
  }

  // 2. Jika DB kosong, ambil dari API (Otomatis handle Januari via Open-Meteo)
  console.log(
    `[Classify] Data cuaca DB kosong, mengambil dari API untuk ${date.toLocaleDateString()}...`,
  );
  const apiWeather = await weatherService.getWeatherData(date);

  if (apiWeather) {
    return {
      suhu_rata: apiWeather.suhu_rata,
      suhu_max: apiWeather.suhu_max,
    };
  }

  return null;
};

/**
 * Klasifikasi Kinerja Unit Terminal (Parameter: Pax + Weather)
 */
export const classifyTerminal = async (date: Date, meterId: number) => {
  try {
    const [aktualKwhData, paxData, weatherData] = await Promise.all([
      prisma.dailySummary.findFirst({
        where: { summary_date: date, meter_id: meterId },
        select: { summary_id: true, total_consumption: true, meter_id: true },
      }),
      prisma.paxData.findFirst({
        where: { data_date: date },
        select: { total_pax: true },
      }),
      getEffectiveWeather(date),
    ]);

    const validKwh = ensureDataExists(aktualKwhData, 'KWH', date);
    const validPax = ensureDataExists(paxData, 'Pax', date);
    const validWeather = ensureDataExists(weatherData, 'Weather', date);

    const mlPayload = {
      pax: validPax.total_pax,
      suhu_rata: validWeather.suhu_rata,
      suhu_max: validWeather.suhu_max,
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
        date,
      );
    }

    return result;
  } catch (error) {
    return handleClassifyError(error, 'Terminal');
  }
};

/**
 * Klasifikasi Kinerja Unit Kantor (Parameter: IsWorkday + Weather)
 */
export const classifyOffice = async (date: Date, meterId: number) => {
  try {
    const [aktualKwhData, weatherData] = await Promise.all([
      prisma.dailySummary.findFirst({
        where: { summary_date: date, meter_id: meterId },
      }),
      getEffectiveWeather(date),
    ]);

    const dayOfWeek = new Date(date).getUTCDay();
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5 ? 1 : 0;

    const validKwh = ensureDataExists(aktualKwhData, 'KWH', date);
    const validWeather = ensureDataExists(weatherData, 'Weather', date);

    const mlPayload = {
      is_hari_kerja: isWorkday,
      suhu_rata: validWeather.suhu_rata,
      suhu_max: validWeather.suhu_max,
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
        date,
      );
    }

    return result;
  } catch (error) {
    return handleClassifyError(error, 'Office');
  }
};

/**
 * Main Entry Point: Dispatcher Klasifikasi berdasarkan Kategori Meter
 */
export const classifyService = async (date: Date, meterId: number) => {
  try {
    const meter = await prisma.meter.findUnique({
      where: { meter_id: meterId },
      include: { category: true },
    });

    if (!meter) throw new Error404(`Meter dengan ID ${meterId} tidak ditemukan.`);

    const categoryName = meter.category?.name?.toLowerCase() || '';

    if (categoryName.includes('terminal')) {
      return await classifyTerminal(date, meterId);
    } else {
      return await classifyOffice(date, meterId);
    }
  } catch (error) {
    return handleClassifyError(error, 'Main Service');
  }
};

/**
 * Helper: Penanganan Error Terpusat
 */
const handleClassifyError = (error: any, context: string) => {
  console.error(`[Classification Error - ${context}]:`, error.message);

  if (error instanceof Error400 || error instanceof Error401 || error instanceof Error404) {
    console.warn(`⚠️ Data tidak lengkap/tidak ditemukan. Melompati klasifikasi ini...`);
    return null; // Mengembalikan null agar loop proses tidak terhenti (crash)
  }

  throw new Error(`Internal Server Error in ${context} Classification`);
};
