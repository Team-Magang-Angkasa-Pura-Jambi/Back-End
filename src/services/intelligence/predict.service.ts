import prisma from '../../configs/db.js';
import { Error400, Error401, Error404 } from '../../utils/customError.js';
import { weatherService } from '../weather.service.js';

import { machineLearningService } from './machineLearning.service.js';

const MODEL_VERSION = 'pax-integrated-v3.1';

const getWeatherPayload = async (date: Date) => {
  const data = await weatherService.getForecast(date);
  return {
    suhu_rata: data?.suhu_rata ?? 28.0,
    suhu_max: data?.suhu_max ?? 32.0,
  };
};

const savePredictionToDb = async (
  date: Date,
  meterId: number,
  value: number,
  typeLabel: string,
) => {
  const result = await prisma.consumptionPrediction.upsert({
    where: {
      prediction_date_meter_id_model_version: {
        prediction_date: date,
        meter_id: meterId,
        model_version: MODEL_VERSION,
      },
    },
    update: { predicted_value: value },
    create: {
      prediction_date: date,
      predicted_value: value,
      meter_id: meterId,
      model_version: MODEL_VERSION,
    },
  });
  console.log(
    `[Prediction] Hasil prediksi ${typeLabel} untuk ${date.toISOString().split('T')[0]} berhasil disimpan.`,
  );
  return result;
};

const handlePredictionError = (error: any, context: string) => {
  console.error(`Error in ${context}:`, error);
  if (error instanceof Error400 || error instanceof Error401 || error instanceof Error404) {
    throw error;
  }
  throw new Error(`Internal Server Error processing ${context}`);
};

export const predictTerminal = async (date: Date, meterId: number) => {
  try {
    const predictionDate = new Date(date);
    const weatherData = await getWeatherPayload(predictionDate);

    const result = await machineLearningService.getTerminalPrediction(predictionDate, weatherData);

    if (result) {
      return await savePredictionToDb(
        predictionDate,
        meterId,
        result.prediksi_kwh_terminal,
        'Terminal',
      );
    }
    return [];
  } catch (error) {
    return handlePredictionError(error, 'Terminal Prediction');
  }
};

export const predictOffice = async (date: Date, meterId: number) => {
  try {
    const predictionDate = new Date(date);
    const weatherData = await getWeatherPayload(predictionDate);

    const result = await machineLearningService.getKantorPrediction(predictionDate, weatherData);

    if (result) {
      const predictionValue = result.prediksi_kwh_kantor ?? result.prediksi_kwh_kantor;

      return await savePredictionToDb(predictionDate, meterId, predictionValue, 'Office');
    }
    return [];
  } catch (error) {
    return handlePredictionError(error, 'Office Prediction');
  }
};

const getDatesInRange = (startDate: Date, endDate: Date): Date[] => {
  const dates = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
};

const formatDateISO = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const predictBulkRange = async (startDate: Date, endDate: Date, meterId: number) => {
  console.time('BulkPredictionTime');

  try {
    const dateList = getDatesInRange(startDate, endDate);
    if (dateList.length === 0) throw new Error('Range tanggal tidak valid');

    const inputPreparationPromises = dateList.map(async (date) => {
      const weather = await weatherService.getForecast(date);

      return {
        tanggal: formatDateISO(date),
        suhu_rata: weather?.suhu_rata ?? 28.0,
        suhu_max: weather?.suhu_max ?? 32.0,
      };
    });

    const mlPayload = await Promise.all(inputPreparationPromises);

    console.log(`Mengirim ${mlPayload.length} data ke ML Server...`);
    const mlResults = await machineLearningService.getBulkPrediction(mlPayload);

    const dbPromises = mlResults.map((result: any) => {
      const resultDate = new Date(result.tanggal);

      return prisma.consumptionPrediction.upsert({
        where: {
          prediction_date_meter_id_model_version: {
            prediction_date: resultDate,
            meter_id: meterId,
            model_version: MODEL_VERSION,
          },
        },
        update: {
          predicted_value: result.prediksi_kwh_terminal,
        },
        create: {
          prediction_date: resultDate,
          predicted_value: result.prediksi_kwh_terminal,
          meter_id: meterId,
          model_version: MODEL_VERSION,
        },
      });
    });

    await Promise.all(dbPromises);

    console.timeEnd('BulkPredictionTime');
    return {
      success: true,
      processed_count: mlResults.length,
      data: mlResults,
    };
  } catch (error) {
    console.error('Error in predictBulkRange:', error);
    throw error;
  }
};

export const predictService = async (date: Date, meterId: number) => {
  try {
    const meter = await prisma.meter.findUnique({
      where: { meter_id: Number(meterId) },
      include: {
        category: true,
      },
    });

    if (!meter) {
      throw new Error404(`Meter dengan ID ${meterId} tidak ditemukan.`);
    }

    const categoryName = meter.category?.name?.toLowerCase() || '';

    if (categoryName.includes('terminal')) {
      return await predictTerminal(date, meter.meter_id);
    } else {
      return await predictOffice(date, meter.meter_id);
    }
  } catch (error) {
    return handlePredictionError(error, 'Prediction');
  }
};
