import prisma from '../configs/db.js';
import type {
  GetAnalysisQuery,
  DailyAnalysisRecord,
} from '../types/analysis.types.js';
import { Error404 } from '../utils/customError.js';

export class AnalysisService {
  public async getMonthlyAnalysis(
    query: GetAnalysisQuery
  ): Promise<DailyAnalysisRecord[]> {
    const { energyType, month } = query;

    // 1. Tentukan rentang tanggal (satu bulan)
    const targetDate = month
      ? new Date(`${month}-01T00:00:00.000Z`)
      : new Date();
    const year = targetDate.getUTCFullYear();
    const monthIndex = targetDate.getUTCMonth();

    const startDate = new Date(Date.UTC(year, monthIndex, 1));
    const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));

    // 2. Cari ID untuk energyType yang diminta
    const energyTypeRecord = await prisma.energyType.findUnique({
      where: { type_name: energyType },
    });
    if (!energyTypeRecord) {
      throw new Error404(`Tipe energi '${energyType}' tidak ditemukan.`);
    }

    // 3. Ambil semua data yang relevan (tidak ada perubahan di sini)
    const summaries = await prisma.dailySummary.findMany({
      where: {
        meter: { energy_type_id: energyTypeRecord.energy_type_id },
        summary_date: { gte: startDate, lte: endDate },
      },
      include: {
        details: true,
      },
    });

    const target = await prisma.efficiencyTarget.findFirst({
      where: {
        energy_type_id: energyTypeRecord.energy_type_id,
        period_start: { lte: endDate },
        period_end: { gte: startDate },
      },
    });

    const predictions = await prisma.consumptionPrediction.findMany({
      where: {
        meter: { energy_type_id: energyTypeRecord.energy_type_id },
        prediction_date: { gte: startDate, lte: endDate },
      },
    });

    // 4. Proses dan gabungkan data menjadi time series harian
    const results: DailyAnalysisRecord[] = [];
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const currentDate = new Date(d);
      const dateString = currentDate.toISOString().split('T')[0];

      const summaryForDay = summaries.find((s) =>
        s.summary_date.toISOString().startsWith(dateString)
      );
      const predictionForDay = predictions.find((p) =>
        p.prediction_date.toISOString().startsWith(dateString)
      );

      // PERBAIKAN: Kalkulasi konsumsi sekarang lebih spesifik
      const totalConsumption =
        summaryForDay?.details?.reduce(
          // Gunakan field 'consumption_value' yang baru
          (acc, detail) =>
            acc + parseFloat(detail.consumption_value.toString()),
          0
        ) ?? null;

      results.push({
        date: currentDate,
        actual_consumption: totalConsumption,
        efficiency_target: target
          ? parseFloat(target.target_value.toString())  
          : null,
        prediction: predictionForDay
          ? parseFloat(predictionForDay.predicted_value.toString())
          : null,
      });
    }

    return results;
  }
}
