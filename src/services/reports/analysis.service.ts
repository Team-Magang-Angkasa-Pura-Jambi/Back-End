import prisma from '../../configs/db.js';
import { type Prisma, type UsageCategory } from '../../generated/prisma/index.js';
import { BaseService } from '../../utils/baseService.js';

export type ClassificationSummary = Partial<Record<UsageCategory, number>> & {
  totalDaysInMonth: number;
  totalDaysWithData: number;
  totalDaysWithClassification: number;
};

interface FuelStockSummaryRecord {
  meterId: number;
  meterName: string;
  remaining_stock: number | null;
  percentage: number | null;
  tank_volume: number | null;
  last_reading_date: Date | null;
}

export interface NewDataCountNotification {
  summary_id: number;
  summary_date: Date;
  total_consumption: number;
  total_cost: number;
  meter_code: string;
  type_name: 'Electricity' | 'Water' | 'Fuel';
  unit_of_measurement: string;
  classification: string | null;
}

export interface TodaySummaryResponse {
  meta: {
    date: Date;
    pax: number | null;
  };
  sumaries: NewDataCountNotification[];
}

export class AnalysisService extends BaseService {
  constructor() {
    super(prisma);
  }

  public async getTodaySummary(
    energyType?: 'Electricity' | 'Water' | 'Fuel',
  ): Promise<TodaySummaryResponse> {
    const todayInJakarta = new Date();

    const dateString = todayInJakarta.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Jakarta',
    });

    const today = new Date(dateString);

    const whereClause: Prisma.DailySummaryWhereInput = {
      summary_date: today,
    };

    if (energyType) {
      whereClause.meter = {
        energy_type: {
          type_name: energyType,
        },
      };
    }

    const [todaySummaries, paxData] = await Promise.all([
      prisma.dailySummary.findMany({
        where: whereClause,
        include: {
          meter: {
            select: {
              meter_code: true,
              energy_type: {
                select: { type_name: true, unit_of_measurement: true },
              },
            },
          },
          classification: { select: { classification: true } },
        },
        orderBy: { meter: { energy_type: { type_name: 'asc' } } },
      }),
      prisma.paxData.findUnique({
        where: { data_date: today },
      }),
    ]);

    const formattedData: NewDataCountNotification[] = todaySummaries.map((item) => {
      return {
        summary_id: item.summary_id,

        summary_date: item.summary_date,

        total_consumption: item.total_consumption?.toNumber() ?? 0,
        total_cost: item.total_cost?.toNumber() ?? 0,

        meter_code: item.meter.meter_code,

        type_name: item.meter.energy_type.type_name as 'Electricity' | 'Water' | 'Fuel',
        unit_of_measurement: item.meter.energy_type.unit_of_measurement,

        classification: item.classification?.classification ?? null,
      };
    });

    return {
      meta: {
        date: today,
        pax: paxData?.total_pax ?? null,
      },
      sumaries: formattedData,
    };
  }
}
