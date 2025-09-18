import prisma from "../configs/db.js";
import type { ChartDataPoint, GetChartDataQuery } from "../types/chart.type.js";

/**
 * Service yang menangani logika untuk mengambil dan menstrukturkan data chart.
 */
export class ChartService {
  /**
   * Menghasilkan data time-series untuk chart analisis pemakaian.
   */
  public async getChartData(query: GetChartDataQuery): Promise<ChartDataPoint[]> {
    // 1. Tentukan rentang tanggal (default bulan ini)
    const today = new Date();
    const defaultStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const startDate = query.startDate ? new Date(query.startDate) : defaultStartDate;
    startDate.setUTCHours(0, 0, 0, 0);

    const endDate = query.endDate ? new Date(query.endDate) : defaultEndDate;
    endDate.setUTCHours(23, 59, 59, 999);

    // 2. Ambil semua pembacaan yang relevan dalam rentang waktu + 1 hari sebelumnya
    const readings = await prisma.readingSession.findMany({
      where: {
        meter: { energy_type: { type_name: query.energyTypeName } },
        timestamp: {
          // Ambil juga data 1 hari sebelum startDate untuk menghitung konsumsi hari pertama
          gte: new Date(startDate.getTime() - 24 * 60 * 60 * 1000),
          lte: endDate,
        },
        corrected_by: null, // Hanya ambil data yang valid
      },
      include: {
        details: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // 3. (Placeholder) Ambil data target efisiensi
    // Logika ini bisa dibuat lebih kompleks sesuai kebutuhan
    const target = await prisma.efficiencyTarget.findFirst({
        where: {
            energy_type: { type_name: query.energyTypeName },
            // Logika untuk menemukan target yang relevan dengan periode
        }
    });
    const efficiencyTargetValue = target ? target.target_value.toNumber() : null;


    // 4. Proses data untuk menghitung konsumsi harian
    const dailyConsumptionMap = new Map<string, number>();
    for (let i = 1; i < readings.length; i++) {
        const currentDate = new Date(readings[i].timestamp).toISOString().split('T')[0];
        const previousValue = readings[i - 1].details[0]?.value.toNumber() ?? 0;
        const currentValue = readings[i].details[0]?.value.toNumber() ?? 0;
        
        if(currentValue >= previousValue) {
            dailyConsumptionMap.set(currentDate, currentValue - previousValue);
        }
    }
    
    // 5. Bangun respons akhir
    const chartData: ChartDataPoint[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      const actualConsumption = dailyConsumptionMap.get(dateString) ?? null;

      chartData.push({
        date: dateString,
        actual_consumption: actualConsumption,
        // (Placeholder) Logika prediksi akan ditambahkan di sini
        predicted_consumption: actualConsumption ? actualConsumption * 1.02 : null,
        efficiency_target: efficiencyTargetValue,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return chartData;
  }
}
