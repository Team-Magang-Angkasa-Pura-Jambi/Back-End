import mlApiClient from '../../common/lib/axios.js';
import prisma from '../../configs/db.js';
import { Error400, Error404 } from '../../utils/customError.js';
import {
  BulkPredictionPayload,
  PredictionQuery,
  SinglePredictionPayload,
} from './predictions.types.js';

export const predictionsService = {
  predictSingle: async (payload: SinglePredictionPayload & { meterId?: number; target_date?: string }) => {
    const meterId = payload.meter_id ?? payload.meterId;
    const dateInput = payload.date ?? payload.target_date;

    if (!meterId || !dateInput) {
      throw new Error400('meter_id dan date wajib disediakan');
    }

    const dateStr = dateInput.split('T')[0];
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

    const meter = await prisma.meter.findUnique({
      where: { meter_id: meterId },
    });

    if (!meter) {
      throw new Error404('Meter tidak ditemukan');
    }

    if (meter.category !== 'TERMINAL' && meter.category !== 'KANTOR') {
      return {
        message: `Meter ${meter.meter_code} berkategori ${meter.category}, AI prediksi hanya mendukung TERMINAL dan KANTOR.`,
        data: null,
      };
    }

    const suhuRata = payload.suhu_rata ?? 29.5;
    const suhuMax = payload.suhu_max ?? 33.0;

    let mlData: any;
    let modelId = '';
    let predictedKwh = 0;

    try {
      const response = await mlApiClient.post('/predict', {
        tanggal: dateStr,
        suhu_rata: suhuRata,
        suhu_max: suhuMax,
      });

      mlData = response.data.data || response.data;
    } catch (error: any) {
      console.error(`[ML API Error Predict Single]: ${error.message}`);
      throw new Error(`Gagal memproses prediksi AI: ${error.message}`);
    }

    if (!mlData) {
      throw new Error400('Response dari Machine Learning API tidak valid');
    }

    if (meter.category === 'TERMINAL') {
      modelId = 'PREDIKSI_TERMINAL_V1';
      predictedKwh = Number(mlData.terminal?.prediksi_kwh || 0);
    } else {
      modelId = 'PREDIKSI_KANTOR_V1';
      predictedKwh = Number(mlData.kantor?.prediksi_kwh || 0);
    }

    const prediction = await prisma.mlPrediction.upsert({
      where: {
        meter_id_model_id_target_date: {
          meter_id: meterId,
          model_id: modelId,
          target_date: targetDate,
        },
      },
      update: {
        predicted_value: predictedKwh,
      },
      create: {
        meter_id: meterId,
        model_id: modelId,
        target_date: targetDate,
        predicted_value: predictedKwh,
      },
    });

    return {
      prediction,
      predicted_pax: mlData.prediksi_pax,
      tanggal: dateStr,
      predicted_value: predictedKwh,
      meter_code: meter.meter_code,
      category: meter.category,
    };
  },

  predictBulk: async (
    payload: BulkPredictionPayload & {
      meterId?: number;
      startDate?: string;
      endDate?: string;
    },
  ) => {
    const meterId = payload.meter_id ?? payload.meterId;
    const startStr = (payload.start_date ?? payload.startDate)?.split('T')[0];
    const endStr = (payload.end_date ?? payload.endDate)?.split('T')[0];

    if (!meterId || !startStr || !endStr) {
      throw new Error400('meter_id, start_date, dan end_date wajib disediakan');
    }

    const meter = await prisma.meter.findUnique({
      where: { meter_id: meterId },
    });

    if (!meter) {
      throw new Error404('Meter tidak ditemukan');
    }

    if (meter.category !== 'TERMINAL' && meter.category !== 'KANTOR') {
      return {
        message: `Meter ${meter.meter_code} berkategori ${meter.category}, AI prediksi hanya mendukung TERMINAL dan KANTOR.`,
        data: [],
      };
    }

    const startDate = new Date(`${startStr}T00:00:00.000Z`);
    const endDate = new Date(`${endStr}T00:00:00.000Z`);

    if (startDate > endDate) {
      throw new Error400('start_date tidak boleh lebih besar dari end_date');
    }

    // Bangkitkan array tanggal
    const dateList: string[] = [];
    const curr = new Date(startDate);
    while (curr <= endDate) {
      dateList.push(curr.toISOString().split('T')[0]);
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    const suhuRata = payload.suhu_rata ?? 29.5;
    const suhuMax = payload.suhu_max ?? 33.0;

    const requestPayload = dateList.map((tgl) => ({
      tanggal: tgl,
      suhu_rata: suhuRata,
      suhu_max: suhuMax,
    }));

    let mlResults: any[] = [];
    try {
      const response = await mlApiClient.post('/predict/bulk', requestPayload);
      mlResults = response.data.data || response.data;
    } catch (error: any) {
      console.error(`[ML API Error Predict Bulk]: ${error.message}`);
      throw new Error(`Gagal memproses prediksi bulk AI: ${error.message}`);
    }

    const modelId =
      meter.category === 'TERMINAL' ? 'PREDIKSI_TERMINAL_V1' : 'PREDIKSI_KANTOR_V1';

    const savedPredictions = await prisma.$transaction(
      mlResults.map((item) => {
        const itemTargetDate = new Date(`${item.tanggal}T00:00:00.000Z`);
        const val =
          meter.category === 'TERMINAL'
            ? Number(item.terminal?.prediksi_kwh || 0)
            : Number(item.kantor?.prediksi_kwh || 0);

        return prisma.mlPrediction.upsert({
          where: {
            meter_id_model_id_target_date: {
              meter_id: meterId,
              model_id: modelId,
              target_date: itemTargetDate,
            },
          },
          update: {
            predicted_value: val,
          },
          create: {
            meter_id: meterId,
            model_id: modelId,
            target_date: itemTargetDate,
            predicted_value: val,
          },
        });
      }),
    );

    return {
      total: savedPredictions.length,
      meter_code: meter.meter_code,
      category: meter.category,
      predictions: savedPredictions,
    };
  },

  getPredictions: async (query: PredictionQuery) => {
    const { meter_id, start_date, end_date, page = 1, limit = 30 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (meter_id) where.meter_id = meter_id;
    if (start_date || end_date) {
      where.target_date = {};
      if (start_date) where.target_date.gte = new Date(`${start_date.split('T')[0]}T00:00:00.000Z`);
      if (end_date) where.target_date.lte = new Date(`${end_date.split('T')[0]}T23:59:59.999Z`);
    }

    const [predictions, total] = await Promise.all([
      prisma.mlPrediction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { target_date: 'asc' },
        include: {
          meter: {
            select: {
              meter_id: true,
              meter_code: true,
              name: true,
              category: true,
            },
          },
        },
      }),
      prisma.mlPrediction.count({ where }),
    ]);

    return {
      data: predictions,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  },
};
