import prisma from '../../configs/db.js';
import { Error400, Error401, Error404 } from '../../utils/customError.js';
import { weatherService } from '../weather.service.js';
import { machineLearningService } from './machineLearning.service.js';

const MODEL_VERSION = 'pax-integrated-v3.1';

/**
 * Helper: Mengambil payload cuaca (Suhu Rata & Max)
 * Sekarang menggunakan getWeatherData yang mendukung history (Januari)
 */
const getWeatherPayload = async (date: Date) => {
  const data = await weatherService.getWeatherData(date);
  return {
    suhu_rata: data?.suhu_rata ?? 28.0,
    suhu_max: data?.suhu_max ?? 32.0,
  };
};

/**
 * Helper: Menyimpan hasil prediksi ke Database (PostgreSQL via Prisma)
 */
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
    `[Prediction] Hasil ${typeLabel} untuk ${date.toLocaleDateString('en-CA')} disimpan.`,
  );
  return result;
};

const handlePredictionError = (error: any, context: string) => {
  console.error(`Error in ${context}:`, error);
  if (error instanceof Error400 || error instanceof Error401 || error instanceof Error404) {
    throw error;
  }
  throw new Error(`Internal Server Error processing ${context}: ${error.message}`);
};

/**
 * Prediksi Unit Terminal
 */
export const predictTerminal = async (date: Date, meterId: number) => {
  try {
    const weatherData = await getWeatherPayload(date);
    const result = await machineLearningService.getTerminalPrediction(date, weatherData);

    if (result) {
      return await savePredictionToDb(date, meterId, result.prediksi_kwh_terminal, 'Terminal');
    }
    return null;
  } catch (error) {
    return handlePredictionError(error, 'Terminal Prediction');
  }
};

/**
 * Prediksi Unit Kantor
 */
export const predictOffice = async (date: Date, meterId: number) => {
  try {
    const weatherData = await getWeatherPayload(date);
    const result = await machineLearningService.getKantorPrediction(date, weatherData);

    if (result) {
      return await savePredictionToDb(date, meterId, result.prediksi_kwh_kantor, 'Office');
    }
    return null;
  } catch (error) {
    return handlePredictionError(error, 'Office Prediction');
  }
};

/**
 * Prediksi Bulk untuk Rentang Tanggal (Sangat berguna untuk pengisian data Januari)
 */
export const predictBulkRange = async (startDate: Date, endDate: Date, meterId: number) => {
  console.time('BulkPredictionTime');
  try {
    const dates = [];
    const curr = new Date(startDate);
    while (curr <= endDate) {
      dates.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    if (dates.length === 0) throw new Error400('Range tanggal tidak valid');

    // 1. Persiapkan Payload Weather untuk semua tanggal
    const inputPreparation = dates.map(async (d) => {
      const weather = await weatherService.getWeatherData(d); // FIX: Menggunakan method baru
      return {
        tanggal: d.toLocaleDateString('en-CA'),
        suhu_rata: weather?.suhu_rata ?? 28.0,
        suhu_max: weather?.suhu_max ?? 32.0,
      };
    });

    const mlPayload = await Promise.all(inputPreparation);

    // 2. Tembak ke Server ML (XGBoost)
    const mlResults = await machineLearningService.getBulkPrediction(mlPayload);

    // 3. Simpan Hasil secara Paralel ke DB
    const dbPromises = mlResults.map((res: any) => {
      return prisma.consumptionPrediction.upsert({
        where: {
          prediction_date_meter_id_model_version: {
            prediction_date: new Date(res.tanggal),
            meter_id: meterId,
            model_version: MODEL_VERSION,
          },
        },
        update: { predicted_value: res.prediksi_kwh_terminal ?? res.prediksi_kwh_kantor },
        create: {
          prediction_date: new Date(res.tanggal),
          predicted_value: res.prediksi_kwh_terminal ?? res.prediksi_kwh_kantor,
          meter_id: meterId,
          model_version: MODEL_VERSION,
        },
      });
    });

    await Promise.all(dbPromises);
    console.timeEnd('BulkPredictionTime');

    return { success: true, count: mlResults.length };
  } catch (error) {
    console.error('Error in predictBulkRange:', error);
    throw error;
  }
};

/**
 * Main Entry Point: Menentukan arah prediksi berdasarkan kategori Meter
 */
export const predictService = async (date: Date, meterId: number) => {
  try {
    const meter = await prisma.meter.findUnique({
      where: { meter_id: Number(meterId) },
      include: { category: true, energy_type: true },
    });

    if (!meter) throw new Error404(`Meter ID ${meterId} tidak ditemukan.`);

    // Validasi: Hanya untuk Listrik (Electricity)
    const energyType = meter.energy_type?.type_name?.toLowerCase() || '';
    if (energyType !== 'electricity') {
      console.warn(`[Prediction] Skipped ID ${meterId}: Bukan tipe Electricity.`);
      return null;
    }

    const category = meter.category?.name?.toLowerCase() || '';
    const predictionDate = new Date(date);

    if (category.includes('terminal')) {
      return await predictTerminal(predictionDate, meter.meter_id);
    } else {
      return await predictOffice(predictionDate, meter.meter_id);
    }
  } catch (error) {
    return handlePredictionError(error, 'Prediction Dispatcher');
  }
};
