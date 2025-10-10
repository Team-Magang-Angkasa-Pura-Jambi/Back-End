import prisma from '../configs/db.js';
import type {
  GetAnalysisQuery,
  DailyAnalysisRecord,
} from '../types/analysis.types.js';
import { Error404 } from '../utils/customError.js';

type MeterAnalysisData = {
  meterId: number;
  meterName: string;
  data: DailyAnalysisRecord[];
};
export class AnalysisService {
  public async getMonthlyAnalysis(
    query: GetAnalysisQuery
  ): Promise<MeterAnalysisData[]> {
    const { energyType, month, meterId } = query;

    // Tentukan rentang tanggal (satu bulan)
    const targetDate = month
      ? new Date(`${month}-01T00:00:00.000Z`)
      : new Date();
    const year = targetDate.getUTCFullYear();
    const monthIndex = targetDate.getUTCMonth();

    const startDate = new Date(Date.UTC(year, monthIndex, 1));
    const endDate = new Date(
      Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)
    );

    // Cari ID untuk energyType yang diminta
    const energyTypeRecord = await prisma.energyType.findUnique({
      where: { type_name: energyType },
    });
    if (!energyTypeRecord) {
      throw new Error(`Tipe energi '${energyType}' tidak ditemukan.`);
    }

    // LANGKAH 2: AMBIL SEMUA DATA RELEVAN DENGAN INFORMASI METER
    // Buat klausa 'where' yang dinamis
    const whereClause: Prisma.DailySummaryWhereInput = {
      meter: {
        energy_type_id: energyTypeRecord.energy_type_id,
        ...(meterId && { meter_id: meterId }), // Tambahkan filter meterId jika ada
      },
      summary_date: { gte: startDate, lte: endDate },
    };

    const summaries = await prisma.dailySummary.findMany({
      where: whereClause,
      include: {
        details: true,
        meter: true, // Sertakan data meter untuk mendapatkan nama dan ID
      },
    });

    // Ambil semua target yang relevan untuk meter yang ditemukan
    const targets = await prisma.efficiencyTarget.findMany({
      where: {
        meter_id: { in: summaries.map((s) => s.meter_id) },
        period_start: { lte: endDate },
        period_end: { gte: startDate },
      },
    });

    // Buat peta untuk akses cepat target per meter
    const targetsByMeter = new Map<number, number | null>();
    for (const target of targets) {
      targetsByMeter.set(
        target.meter_id,
        parseFloat(target.target_value.toString())
      );
    }

    const predictions = await prisma.consumptionPrediction.findMany({
      where: {
        meter: {
          energy_type_id: energyTypeRecord.energy_type_id,
          ...(meterId && { meter_id: meterId }), // Tambahkan filter meterId jika ada
        },
        prediction_date: { gte: startDate, lte: endDate },
      },
    });

    // LANGKAH 3: PROSES DAN KELOMPOKKAN DATA PER METER ID
    const dataByMeter = new Map<
      number,
      {
        meterName: string;
        dailyData: Map<string, Partial<DailyAnalysisRecord>>; // Gunakan Partial karena data diisi bertahap
      }
    >();

    // Proses data konsumsi aktual
    for (const summary of summaries) {
      const meterId = summary.meter_id;
      const meterName = summary.meter.meter_code;
      const dateString = summary.summary_date.toISOString().split('T')[0];

      if (!dataByMeter.has(meterId)) {
        dataByMeter.set(meterId, { meterName, dailyData: new Map() });
      }

      const totalConsumption = summary.details.reduce(
        (acc, detail) => acc + parseFloat(detail.consumption_value.toString()),
        0
      );

      const dayData = dataByMeter.get(meterId)!.dailyData.get(dateString) || {};
      dayData.actual_consumption = totalConsumption;
      dataByMeter.get(meterId)!.dailyData.set(dateString, dayData);
    }

    // Proses data prediksi
    for (const prediction of predictions) {
      const meterId = prediction.meter_id;
      const dateString = prediction.prediction_date.toISOString().split('T')[0];

      if (dataByMeter.has(meterId)) {
        const dayData =
          dataByMeter.get(meterId)!.dailyData.get(dateString) || {};
        dayData.prediction = parseFloat(prediction.predicted_value.toString());
        dataByMeter.get(meterId)!.dailyData.set(dateString, dayData);
      }
    }

    // LANGKAH 4: BANGUN SERI WAKTU LENGKAP UNTUK SETIAP METER
    const finalResults: MeterAnalysisData[] = [];

    for (const [meterId, meterInfo] of dataByMeter.entries()) {
      const timeSeries: DailyAnalysisRecord[] = [];

      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        const currentDate = new Date(d);
        const dateString = currentDate.toISOString().split('T')[0];

        const dayData = meterInfo.dailyData.get(dateString);

        timeSeries.push({
          date: currentDate,
          actual_consumption: dayData?.actual_consumption ?? null,
          prediction: dayData?.prediction ?? null,
          efficiency_target: targetsByMeter.get(meterId) ?? null,
        });
      }

      finalResults.push({
        meterId,
        meterName: meterInfo.meterName,
        data: timeSeries,
      });
    }

    return finalResults;
  }
}
