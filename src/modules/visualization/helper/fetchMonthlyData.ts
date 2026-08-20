import prisma from '../../../configs/db.js';
import { weatherConfig } from '../../../configs/weather.js';
import { MonthlyDataResponse, EnergySummary } from '../visualization.service.js';
import { dashboardConfigService } from '../dashboard_config.service.js';

const ENERGY_TYPE_MAP: Record<string, string> = {
  '1': 'Electricity',
  '2': 'Water',
  '3': 'Fuel',
};

export const fetchMonthlyData = async (start: Date, end: Date): Promise<MonthlyDataResponse> => {
  const weatherUrl = `${weatherConfig.baseURL}?lat=${weatherConfig.latitude}&lon=${weatherConfig.longitude}&appid=${weatherConfig.apiKey}&units=metric`;

  const [cardConfig, energyRecords, paxAgg, weatherResponse] = await Promise.all([
    dashboardConfigService.getCardConfig(),

    prisma.dailySummary.findMany({
      where: {
        summary_date: { gte: start, lte: end },
      },
      select: {
        meter_id: true,
        total_usage: true,
        total_cost: true,
        meter: {
          select: { energy_type_id: true },
        },
      },
    }),

    prisma.paxData.aggregate({
      where: {
        date: { gte: start, lte: end },
      },
      _sum: { pax_count: true },
    }),

    fetch(weatherUrl)
      .then((res) => {
        if (!res.ok) throw new Error('API Cuaca merespons dengan error');
        return res.json();
      })
      .catch((err) => {
        console.warn('Gagal mengambil data dari OpenWeatherMap:', err.message);
        return null;
      }),
  ]);

  const energySummary: Record<string, EnergySummary> = {
    Electricity: { consumption: 0, cost: 0 },
    Water: { consumption: 0, cost: 0 },
    Fuel: { consumption: 0, cost: 0 },
  };

  energyRecords.forEach((record) => {
    const rawId = record.meter?.energy_type_id?.toString() ?? 'unknown';
    const energyType = ENERGY_TYPE_MAP[rawId] ?? 'Unknown';

    if (!energySummary[energyType]) {
      energySummary[energyType] = { consumption: 0, cost: 0 };
    }

    // Filter berdasarkan meteran yang dikonfigurasi di dashboard cards
    const meterId = record.meter_id;

    if (energyType === 'Electricity' && (cardConfig.electricityMeterIds?.length ?? 0) > 0) {
      if (!cardConfig.electricityMeterIds?.includes(meterId)) {
        return; // Lewati meter listrik yang tidak dipilih
      }
    } else if (energyType === 'Water' && (cardConfig.waterMeterIds?.length ?? 0) > 0) {
      if (!cardConfig.waterMeterIds?.includes(meterId)) {
        return; // Lewati meter air yang tidak dipilih
      }
    } else if (energyType === 'Fuel' && (cardConfig.fuelMeterIds?.length ?? 0) > 0) {
      if (!cardConfig.fuelMeterIds?.includes(meterId)) {
        return; // Lewati meter BBM yang tidak dipilih
      }
    }

    energySummary[energyType].consumption += Number(record.total_usage ?? 0);
    energySummary[energyType].cost += Number(record.total_cost ?? 0);
  });

  let avgTemp = 0;
  let avgMaxTemp = 0;

  if (weatherResponse && weatherResponse.list) {
    const todayForecasts = weatherResponse.list.slice(0, 8);

    let sumTemp = 0;
    let maxTemp = -Infinity;

    todayForecasts.forEach((forecast: any) => {
      const temp = Number(forecast.main?.temp ?? 0);
      const tempMax = Number(forecast.main?.temp_max ?? 0);

      sumTemp += temp;
      if (tempMax > maxTemp) {
        maxTemp = tempMax;
      }
    });

    avgTemp = sumTemp / todayForecasts.length;
    avgMaxTemp = maxTemp === -Infinity ? 0 : maxTemp;
  }

  const totalPax = Number(paxAgg._sum.pax_count ?? 0);

  return {
    energySummary,
    totalPax,
    avgTemp: Number(avgTemp.toFixed(1)),
    avgMaxTemp: Number(avgMaxTemp.toFixed(1)),
  };
};
