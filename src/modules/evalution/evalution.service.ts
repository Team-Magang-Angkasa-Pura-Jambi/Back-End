import mlApiClient from '../../common/lib/axios.js';
import prisma from '../../configs/db.js';
import { Error400, Error404 } from '../../utils/customError.js';

export interface EvaluationPayload {
  suhu_rata?: number;
  suhu_max?: number;
  pax?: number;
  is_hari_kerja?: number;
}

export const evaluationService = {
  run: async (payload: EvaluationPayload, meter_id: number, summary_id: number) => {
    // 1. Ambil Meter sekaligus DailySummary dan detailnya
    const meter = await prisma.meter.findUnique({
      where: { meter_id },
      include: {
        daily_summaries: {
          where: { summary_id },
          include: {
            summary_details: true,
          },
        },
      },
    });

    if (!meter) {
      throw new Error404('Meter Tidak Ditemukan');
    }

    const summary = meter.daily_summaries[0];
    if (!summary) {
      throw new Error404('Daily Summary tidak ditemukan untuk meteran ini');
    }

    // Ekstrak detail suhu dari summary jika tidak disediakan di payload
    const detailsMap: Record<string, number> = {};
    summary.summary_details.forEach((d) => {
      detailsMap[d.label.toLowerCase().trim()] = Number(d.value);
    });

    const suhuRata =
      payload.suhu_rata ??
      detailsMap['suhu rata-rata'] ??
      detailsMap['suhu rata rata'] ??
      detailsMap['suhu'] ??
      29.5;

    const suhuMax =
      payload.suhu_max ??
      detailsMap['suhu max'] ??
      detailsMap['suhu maksimal'] ??
      33.0;

    // Ekstrak status hari kerja
    let isHariKerja = payload.is_hari_kerja;
    if (isHariKerja === undefined) {
      const dayOfWeek = summary.summary_date.getUTCDay();
      isHariKerja = dayOfWeek === 0 || dayOfWeek === 6 ? 0 : 1;
    }

    // Ekstrak pax data dari database jika tidak disediakan
    let paxCount = payload.pax;
    if (paxCount === undefined) {
      const paxRecord = await prisma.paxData.findFirst({
        where: {
          date: summary.summary_date,
        },
      });
      paxCount = paxRecord ? paxRecord.pax_count : 0;
    }

    let mlResult;
    let modelUsed = '';

    try {
      if (meter.category === 'TERMINAL') {
        const mlPayload = {
          pax: paxCount,
          suhu_rata: suhuRata,
          suhu_max: suhuMax,
          aktual_kwh_terminal: Number(summary.total_usage),
        };

        const response = await mlApiClient.post('/evaluate/terminal', mlPayload);
        mlResult = response.data.terminal || response.data.data?.terminal || response.data.data;
        modelUsed = 'EVALUASI_TERMINAL_V1';
      } else if (meter.category === 'KANTOR') {
        const mlPayload = {
          suhu_rata: suhuRata,
          suhu_max: suhuMax,
          is_hari_kerja: isHariKerja,
          aktual_kwh_kantor: Number(summary.total_usage),
        };

        const response = await mlApiClient.post('/evaluate/kantor', mlPayload);
        mlResult = response.data.kantor || response.data.data?.kantor || response.data.data;
        modelUsed = 'EVALUASI_KANTOR_V1';
      } else {
        console.log(`Meter ${meter.meter_code} berkategori ${meter.category}, tidak menggunakan ML.`);
        return null;
      }
    } catch (error: any) {
      console.error(`[ML API Error]: ${error.message}`);
      throw new Error(`Gagal memproses AI: ${error.message}`);
    }

    if (mlResult) {
      const classification = await prisma.mlClassification.upsert({
        where: {
          daily_summary_id: summary_id,
        },
        update: {
          model_used: modelUsed,
          label: mlResult.kinerja,
          deviation_percent: mlResult.deviasi_persen,
          benchmark_value: mlResult.benchmark_kwh,
        },
        create: {
          model_used: modelUsed,
          label: mlResult.kinerja,
          deviation_percent: mlResult.deviasi_persen,
          benchmark_value: mlResult.benchmark_kwh,
          daily_summary_id: summary_id,
        },
      });

      return classification;
    }

    throw new Error400(
      `Data AI gagal diparsing. Format response dari ML API tidak sesuai ekspektasi.`,
    );
  },
};
