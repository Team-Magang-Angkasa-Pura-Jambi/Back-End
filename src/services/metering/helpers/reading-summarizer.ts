import { Prisma } from '../../../generated/prisma/index.js';
import { MeterWithRelations } from '../../../types/metering/meter.types-temp.js';
import {
  CreateReadingSessionInternal,
  SessionWithDetails,
} from '../types/index.js';
import {
  _calculateAndDistributeFuelSummary,
  _calculateSummaryDetails,
} from './consumption-calc.js';
import { _normalizeDate } from './reading-validator.js';

export const _createOrUpdateDistributedSummary = async (
  tx: Prisma.TransactionClient,
  meter: MeterWithRelations,
  date: Date,
  summaryDetails: Omit<
    Prisma.SummaryDetailCreateInput,
    'summary' | 'summary_id'
  >[]
): Promise<Prisma.DailySummaryGetPayload<{}>> => {
  const totalConsumption =
    summaryDetails[0]?.consumption_value ?? new Prisma.Decimal(0);
  const totalCost =
    summaryDetails[0]?.consumption_cost ?? new Prisma.Decimal(0);

  const summary = await tx.dailySummary.upsert({
    where: {
      summary_date_meter_id: {
        summary_date: date,
        meter_id: meter.meter_id,
      },
    },
    update: { total_consumption: totalConsumption, total_cost: totalCost },
    create: {
      summary_date: date,
      meter_id: meter.meter_id,
      total_consumption: totalConsumption,
      total_cost: totalCost,
    },
  });

  await tx.summaryDetail.deleteMany({
    where: { summary_id: summary.summary_id },
  });

  await tx.summaryDetail.createMany({
    data: summaryDetails.map((detail) => {
      const { energy_type, ...rest } = detail;

      const energyTypeId = (energy_type as any)?.connect?.energy_type_id;

      if (!energyTypeId) {
        throw new Error('Energy Type ID is missing in summary details');
      }

      return {
        ...rest,
        summary_id: summary.summary_id,
        energy_type_id: energyTypeId,
      };
    }),
  });

  return summary;
};

export const _createSingleSummaryFromDetails = async (
  tx: Prisma.TransactionClient,
  meterId: number,
  date: Date,
  details: Omit<Prisma.SummaryDetailCreateInput, 'summary' | 'summary_id'>[]
): Promise<Prisma.DailySummaryGetPayload<{}> | null> => {
  if (details.length === 0) return null;

  const totalCost = details[0].consumption_cost ?? new Prisma.Decimal(0);
  const totalConsumption =
    details[0].consumption_value ?? new Prisma.Decimal(0);

  const summary = await tx.dailySummary.upsert({
    where: {
      summary_date_meter_id: {
        summary_date: date,
        meter_id: meterId,
      },
    },
    update: {
      total_cost: totalCost,
      total_consumption: totalConsumption,
    },
    create: {
      summary_date: date,
      meter_id: meterId,
      total_cost: totalCost,
      total_consumption: totalConsumption,
    },
  });
  return summary;
};

export const _getLatestPriceScheme = async (
  tx: Prisma.TransactionClient,
  tariffGroupOrId:
    | number
    | Prisma.TariffGroupGetPayload<{
        include: {
          price_schemes: {
            include: {
              rates: {
                include: { reading_type: { include: { energy_type: true } } };
              };
              taxes: true;
            };
          };
        };
      }>,
  date: Date
) => {
  if (
    typeof tariffGroupOrId === 'object' &&
    'price_schemes' in tariffGroupOrId
  ) {
    return (
      tariffGroupOrId.price_schemes
        .filter((ps) => ps.effective_date <= date && ps.is_active)
        .sort(
          (a, b) => b.effective_date.getTime() - a.effective_date.getTime()
        )[0] || null
    );
  } else {
    return tx.priceScheme.findFirst({
      where: {
        tariff_group_id: tariffGroupOrId as number,
        effective_date: { lte: date },
        is_active: true,
      },
      orderBy: { effective_date: 'desc' },
      include: {
        rates: { include: { reading_type: true } },
        taxes: { include: { tax: true } },
      },
    });
  }
};

export const _findOrCreateSession = async (
  tx: Prisma.TransactionClient,
  meter_id: number,
  reading_date: Date,
  user_id: number
) => {
  const existingSession = await tx.readingSession.findUnique({
    where: { unique_meter_reading_per_day: { reading_date, meter_id } },
  });
  if (existingSession) return { sessionId: existingSession.session_id };

  const newSession = await tx.readingSession.create({
    data: { meter_id, user_id, reading_date },
  });
  return { sessionId: newSession.session_id };
};

export const _createReadingDetails = async (
  tx: Prisma.TransactionClient,
  sessionId: number,
  details: CreateReadingSessionInternal['details']
) => {
  const detailsToCreate = details.map((detail) => ({
    session_id: sessionId,
    reading_type_id: detail.reading_type_id,
    value: detail.value,
  }));
  await tx.readingDetail.createMany({ data: detailsToCreate });
};

export const _updateDailySummary = async (
  tx: Prisma.TransactionClient,
  meter: MeterWithRelations,
  dateForDb: Date
): Promise<Prisma.DailySummaryGetPayload<{}>[] | null> => {
  const currentSession = await tx.readingSession.findUnique({
    where: {
      unique_meter_reading_per_day: {
        reading_date: dateForDb,
        meter_id: meter.meter_id,
      },
    },
    include: { details: true },
  });

  if (!currentSession) return null;

  let previousSession: SessionWithDetails | null;

  if (meter.energy_type.type_name === 'Fuel') {
    const previousFuelSession = await tx.readingSession.findFirst({
      where: {
        meter_id: meter.meter_id,
        // reading_date: { lt: dateForDb },
      },
      orderBy: { reading_date: 'desc' },
      include: { details: true },
    });

    return _calculateAndDistributeFuelSummary(
      tx,
      meter,
      currentSession,
      previousFuelSession
    );
  } else {
    const previousDate = new Date(dateForDb);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);

    previousSession = await tx.readingSession.findUnique({
      where: {
        unique_meter_reading_per_day: {
          reading_date: previousDate,
          meter_id: meter.meter_id,
        },
      },
      include: { details: true },
    });
  }

  const summaryDetailsToCreate = await _calculateSummaryDetails(
    tx,
    meter,
    currentSession,
    previousSession
  );
  if (summaryDetailsToCreate.length === 0) return null;

  const finalTotalCost = summaryDetailsToCreate.reduce((sum, detail) => {
    const rawCost = detail.consumption_cost ?? 0;
    const safeCost = new Prisma.Decimal(rawCost as any);

    return detail.metric_name !== 'Total Pemakaian' ? sum.plus(safeCost) : sum;
  }, new Prisma.Decimal(0));

  const finalTotalConsumption = summaryDetailsToCreate.reduce((sum, detail) => {
    const rawCost = detail.consumption_value ?? 0;
    const safeCost = new Prisma.Decimal(rawCost as any);

    return !detail.metric_name.includes('WBP') &&
      !detail.metric_name.includes('LWBP')
      ? sum.plus(new Prisma.Decimal(safeCost))
      : sum;
  }, new Prisma.Decimal(0));

  const dailySummary = await tx.dailySummary.upsert({
    where: {
      summary_date_meter_id: {
        summary_date: dateForDb,
        meter_id: meter.meter_id,
      },
    },
    update: {
      total_cost: finalTotalCost,
      total_consumption: finalTotalConsumption,
    },
    create: {
      summary_date: dateForDb,
      meter_id: meter.meter_id,
      total_cost: finalTotalCost,
      total_consumption: finalTotalConsumption,
    },
  });

  await tx.summaryDetail.deleteMany({
    where: { summary_id: dailySummary.summary_id },
  });

  await tx.summaryDetail.createMany({
    data: summaryDetailsToCreate.map((detail) => {
      const { energy_type, ...rest } = detail;

      const energyTypeId = (energy_type as any)?.connect?.energy_type_id;
      if (!energyTypeId) {
        throw new Error('Energy Type ID is missing in summary details');
      }

      return {
        ...rest,
        summary_id: dailySummary.summary_id,
        energy_type_id: energyTypeId,
      };
    }),
  });

  return [dailySummary];
};

export const _buildWhereClause = (
  date?: Date,
  energyTypeName?: string,
  startDate?: Date,
  endDate?: Date,
  meterId?: number
): Prisma.ReadingSessionWhereInput => {
  const where: Prisma.ReadingSessionWhereInput = {};
  const meterFilter: Prisma.MeterWhereInput = {};

  if (energyTypeName) {
    meterFilter.energy_type = {
      type_name: energyTypeName,
    };
  }

  if (meterId) {
    where.meter_id = meterId;
  }

  if (Object.keys(meterFilter).length > 0) {
    where.meter = meterFilter;
  }

  if (date) {
    where.reading_date = _normalizeDate(date);
  } else if (startDate && endDate) {
    where.reading_date = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  }

  return where;
};

export const _buildOrderByClause = (
  sortBy: string | 'reading_date' | 'created_at' = 'reading_date',
  sortOrder: 'asc' | 'desc' = 'desc'
): Prisma.ReadingSessionOrderByWithRelationInput => {
  const orderBy: Prisma.ReadingSessionOrderByWithRelationInput = {};

  if (sortBy === 'reading_date') {
    orderBy.reading_date = sortOrder;
  } else if (sortBy === 'created_at') {
    orderBy.created_at = sortOrder;
  }

  return orderBy;
};
