import {
  Prisma,
  type ReadingDetail,
  type ReadingSession,
  RoleName,
} from '../../../generated/prisma/index.js';
import { type MeterWithRelations } from '../../../types/metering/meter.types-temp.js';
import { Error400, Error404, Error500 } from '../../../utils/customError.js';
import { alertService } from '../../notifications/alert.service.js';
import { notificationService } from '../../notifications/notification.service.js';
import {
  _createOrUpdateDistributedSummary,
  _createSingleSummaryFromDetails,
  _getLatestPriceScheme,
} from './reading-summarizer.js';

type SessionWithDetails = ReadingSession & { details: ReadingDetail[] };

export const _calculateSummaryDetails = async (
  tx: Prisma.TransactionClient,
  meter: MeterWithRelations,
  currentSession: SessionWithDetails,
  previousSession: SessionWithDetails | null,
): Promise<Omit<Prisma.SummaryDetailCreateInput, 'summary' | 'summary_id'>[]> => {
  const activePriceScheme = await _getLatestPriceScheme(
    tx,
    meter.tariff_group_id,
    currentSession.reading_date,
  );
  const summaryDetails: Omit<Prisma.SummaryDetailCreateInput, 'summary' | 'summary_id'>[] = [];

  if (meter.energy_type.type_name === 'Electricity') {
    return _calculateElectricitySummary(
      tx,
      meter,
      currentSession,
      previousSession,
      activePriceScheme,
    );
  }

  if (meter.energy_type.type_name === 'Water') {
    return _calculateWaterSummary(tx, meter, currentSession, previousSession, activePriceScheme);
  }

  return summaryDetails;
};

export const _calculateElectricitySummary = async (
  tx: Prisma.TransactionClient,
  meter: MeterWithRelations,
  currentSession: SessionWithDetails,
  previousSession: SessionWithDetails | null,
  priceScheme: Prisma.PriceSchemeGetPayload<{
    include: { rates: { include: { reading_type: true } } };
  }> | null,
) => {
  if (!priceScheme) {
    throw new Error404(
      `Konfigurasi harga untuk golongan tarif '${meter.tariff_group.group_code}' pada tanggal ${
        currentSession.reading_date.toISOString().split('T')[0]
      } tidak ditemukan.`,
    );
  }

  const wbpType = await tx.readingType.findUnique({
    where: { type_name: 'WBP' },
  });
  const lwbpType = await tx.readingType.findUnique({
    where: { type_name: 'LWBP' },
  });

  if (!wbpType || !lwbpType) {
    throw new Error500(
      'Konfigurasi sistem error: Tipe bacaan WBP atau LWBP tidak ditemukan di database.',
    );
  }

  const getDetailValue = (session: SessionWithDetails | null, typeId: number) =>
    session?.details.find((d) => d.reading_type_id === typeId)?.value;

  const faktorKali = new Prisma.Decimal(1);

  const rateWbp = priceScheme.rates.find((r) => r.reading_type_id === wbpType.reading_type_id);
  const rateLwbp = priceScheme.rates.find((r) => r.reading_type_id === lwbpType.reading_type_id);

  if (!rateWbp || !rateLwbp) {
    throw new Error404(
      `Tarif WBP atau LWBP tidak terdefinisi dalam skema harga '${priceScheme.scheme_name}'.`,
    );
  }

  const HARGA_WBP = new Prisma.Decimal(rateWbp.value);
  const HARGA_LWBP = new Prisma.Decimal(rateLwbp.value);

  const wbpConsumption = _calculateSafeConsumption(
    getDetailValue(currentSession, wbpType.reading_type_id),
    getDetailValue(previousSession, wbpType.reading_type_id),
    meter.rollover_limit,
  );

  const lwbpConsumption = _calculateSafeConsumption(
    getDetailValue(currentSession, lwbpType.reading_type_id),
    getDetailValue(previousSession, lwbpType.reading_type_id),
    meter.rollover_limit,
  );
  const wbpCost = wbpConsumption.times(faktorKali).times(HARGA_WBP);
  const lwbpCost = lwbpConsumption.times(faktorKali).times(HARGA_LWBP);

  const summaryDetails: Omit<Prisma.SummaryDetailCreateInput, 'summary' | 'summary_id'>[] = [
    {
      metric_name: 'Pemakaian WBP',
      energy_type: { connect: { energy_type_id: meter.energy_type_id } },
      current_reading:
        getDetailValue(currentSession, wbpType.reading_type_id) ?? new Prisma.Decimal(0),
      previous_reading:
        getDetailValue(previousSession, wbpType.reading_type_id) ?? new Prisma.Decimal(0),
      consumption_value: wbpConsumption,
      consumption_cost: wbpCost,
      wbp_value: wbpConsumption,
    },
    {
      metric_name: 'Pemakaian LWBP',
      energy_type: { connect: { energy_type_id: meter.energy_type_id } },

      current_reading:
        getDetailValue(currentSession, lwbpType.reading_type_id) ?? new Prisma.Decimal(0),
      previous_reading:
        getDetailValue(previousSession, lwbpType.reading_type_id) ?? new Prisma.Decimal(0),
      consumption_value: lwbpConsumption,
      consumption_cost: lwbpCost,
      lwbp_value: lwbpConsumption,
    },
  ];

  summaryDetails.push({
    metric_name: 'Total Pemakaian',
    energy_type: { connect: { energy_type_id: meter.energy_type_id } },
    current_reading: new Prisma.Decimal(0),
    previous_reading: new Prisma.Decimal(0),
    consumption_value: wbpConsumption.plus(lwbpConsumption),
    consumption_cost: wbpCost.plus(lwbpCost),
  });

  return summaryDetails;
};

export const _calculateFuelSummary = async (
  tx: Prisma.TransactionClient,
  meter: MeterWithRelations,
  currentSession: SessionWithDetails,
  previousSession: SessionWithDetails | null,
  priceScheme: Prisma.PriceSchemeGetPayload<{
    include: { rates: true };
  }> | null,
) => {
  if (!priceScheme) {
    throw new Error404(
      `Konfigurasi harga untuk golongan tarif '${meter.tariff_group.group_code}' pada tanggal ${
        currentSession.reading_date.toISOString().split('T')[0]
      } tidak ditemukan.`,
    );
  }

  if (!meter.tank_height_cm || !meter.tank_volume_liters || meter.tank_height_cm.isZero()) {
    throw new Error400(
      `Konfigurasi tangki (tinggi & volume) untuk meter '${meter.meter_code}' belum diatur atau tidak valid.`,
    );
  }

  const litersPerCm = meter.tank_volume_liters.div(meter.tank_height_cm);

  const mainType = await tx.readingType.findFirst({
    where: { energy_type_id: meter.energy_type_id },
  });

  if (!mainType) return [];

  const getDetailValue = (session: SessionWithDetails | null, typeId: number) =>
    session?.details.find((d) => d.reading_type_id === typeId)?.value ?? 0;

  const rate = priceScheme.rates.find((r) => r.reading_type_id === mainType.reading_type_id);

  if (!rate) {
    throw new Error404(
      `Tarif untuk '${mainType.type_name}' tidak terdefinisi dalam skema harga '${priceScheme.scheme_name}'.`,
    );
  }
  const HARGA_SATUAN = new Prisma.Decimal(rate.value);

  const currentHeight = new Prisma.Decimal(
    getDetailValue(currentSession, mainType.reading_type_id) ?? 0,
  );

  const previousHeight = new Prisma.Decimal(
    getDetailValue(previousSession, mainType.reading_type_id) ?? 0,
  );

  const heightDifference = previousHeight.minus(currentHeight);
  let consumptionInLiters: Prisma.Decimal;

  if (heightDifference.isNegative()) {
    consumptionInLiters = new Prisma.Decimal(0);

    const lowFuelAlertTitle = `Peringatan: Stok BBM Menipis`;
    const alertsToResolve = await tx.alert.findMany({
      where: {
        meter_id: meter.meter_id,
        title: lowFuelAlertTitle,
        status: 'NEW',
      },
    });

    if (alertsToResolve.length > 0) {
      const alertIds = alertsToResolve.map((a) => a.alert_id);
      await tx.alert.updateMany({
        where: {
          alert_id: { in: alertIds },
        },
        data: {
          status: 'HANDLED',
          acknowledged_by_user_id: currentSession.user_id,
        },
      });
      console.log(
        `[ReadingService] Resolved ${alertsToResolve.length} low fuel alerts for meter ${meter.meter_code} due to refill.`,
      );
    }

    if (meter.tank_height_cm && currentHeight.equals(meter.tank_height_cm)) {
      const admins = await tx.user.findMany({
        where: {
          role: { role_name: { in: [RoleName.Admin, RoleName.SuperAdmin] } },
          is_active: true,
        },
        select: { user_id: true },
      });

      const title = `Info: Pengisian Penuh BBM Terdeteksi`;
      const message = `Telah terjadi pengisian penuh BBM untuk meter '${
        meter.meter_code
      }'. Ketinggian mencapai kapasitas maksimal: ${currentHeight.toFixed(2)} cm.`;

      for (const admin of admins) {
        await notificationService.create({
          user_id: admin.user_id,
          title,
          message,
        });
      }
      console.log(
        `[ReadingService] Full fuel refill detected for meter ${meter.meter_code}. Notification sent.`,
      );
    }
  } else {
    consumptionInLiters = heightDifference.times(litersPerCm);

    const LOW_FUEL_THRESHOLD_CM = new Prisma.Decimal(20);

    if (
      currentHeight.lessThan(LOW_FUEL_THRESHOLD_CM) &&
      previousHeight.greaterThanOrEqualTo(LOW_FUEL_THRESHOLD_CM)
    ) {
      const title = `Peringatan: Stok BBM Menipis`;
      const message = `Stok BBM untuk meter '${
        meter.meter_code
      }' telah mencapai level rendah (${currentHeight.toFixed(
        2,
      )} cm). Mohon segera lakukan pengisian ulang.`;

      await alertService.create({
        title,
        description: message,
        meter: { connect: { meter_id: meter.meter_id } },
      });

      const admins = await tx.user.findMany({
        where: {
          role: { role_name: { in: [RoleName.Admin, RoleName.SuperAdmin] } },
          is_active: true,
        },
        select: { user_id: true },
      });

      for (const admin of admins) {
        await notificationService.create({
          user_id: admin.user_id,
          title,
          message,
        });
      }
      console.log(
        `[ReadingService] Low fuel level detected for meter ${meter.meter_code}. Alert sent.`,
      );
    }
  }

  const remainingStockLiters = currentHeight.times(litersPerCm);

  return [
    {
      metric_name: currentHeight.equals(meter.tank_height_cm)
        ? 'Pengisian Penuh'
        : `Pemakaian Harian (${meter.energy_type.type_name})`,
      energy_type: { connect: { energy_type_id: meter.energy_type_id } },
      current_reading: currentHeight,
      previous_reading: previousHeight,
      consumption_value: consumptionInLiters,
      consumption_cost: consumptionInLiters.times(HARGA_SATUAN),
      remaining_stock: remainingStockLiters,
    },
  ];
};

export const _calculateWaterSummary = async (
  tx: Prisma.TransactionClient,
  meter: MeterWithRelations,
  currentSession: SessionWithDetails,
  previousSession: SessionWithDetails | null,
  priceScheme: Prisma.PriceSchemeGetPayload<{
    include: { rates: true };
  }> | null,
) => {
  if (!priceScheme) {
    throw new Error404(
      `Konfigurasi harga untuk golongan tarif '${meter.tariff_group.group_code}' pada tanggal ${
        currentSession.reading_date.toISOString().split('T')[0]
      } tidak ditemukan.`,
    );
  }

  const mainType = await tx.readingType.findFirst({
    where: { energy_type_id: meter.energy_type_id },
  });
  if (!mainType) return [];

  const getDetailValue = (session: SessionWithDetails | null, typeId: number) =>
    session?.details.find((d) => d.reading_type_id === typeId)?.value;

  const rate = priceScheme.rates.find((r) => r.reading_type_id === mainType.reading_type_id);

  if (!rate) {
    throw new Error404(
      `Tarif untuk '${mainType.type_name}' tidak terdefinisi dalam skema harga '${priceScheme.scheme_name}'.`,
    );
  }
  const HARGA_SATUAN = new Prisma.Decimal(rate.value);

  const consumption = _calculateSafeConsumption(
    getDetailValue(currentSession, mainType.reading_type_id),
    getDetailValue(previousSession, mainType.reading_type_id),
    meter.rollover_limit,
  );

  return [
    {
      metric_name: `Pemakaian Harian (${meter.energy_type.type_name})`,
      energy_type: { connect: { energy_type_id: meter.energy_type_id } },
      current_reading:
        getDetailValue(currentSession, mainType.reading_type_id) ?? new Prisma.Decimal(0),
      previous_reading:
        getDetailValue(previousSession, mainType.reading_type_id) ?? new Prisma.Decimal(0),
      consumption_value: consumption,
      consumption_cost: consumption.times(HARGA_SATUAN),
    },
  ];
};

export const _calculateSafeConsumption = (
  currentValue?: Prisma.Decimal,
  previousValue?: Prisma.Decimal,
  rolloverLimit?: Prisma.Decimal | null,
) => {
  if (currentValue === undefined || currentValue === null) {
    return new Prisma.Decimal(0);
  }

  const current = currentValue;
  const previous = previousValue ?? new Prisma.Decimal(0);

  if (current.lessThan(previous)) {
    if (
      rolloverLimit &&
      !rolloverLimit.isZero() &&
      previous.greaterThan(rolloverLimit.times(0.9)) &&
      current.lessThan(rolloverLimit.times(0.1))
    ) {
      const consumptionBeforeReset = rolloverLimit.minus(previous);
      const consumptionAfterReset = current;
      return consumptionBeforeReset.plus(consumptionAfterReset);
    } else {
      throw new Error400(
        `Nilai baru (${current.toLocaleString()}) tidak boleh lebih kecil dari nilai sebelumnya (${previous.toLocaleString()}) untuk meteran yang tidak memiliki batas reset (rollover).`,
      );
    }
  }
  return current.minus(previous);
};

export const _calculateAndDistributeFuelSummary = async (
  tx: Prisma.TransactionClient,
  meter: MeterWithRelations,
  currentSession: SessionWithDetails,
  previousSession: SessionWithDetails | null,
): Promise<Prisma.DailySummaryGetPayload<object>[]> => {
  const priceScheme = await _getLatestPriceScheme(
    tx,
    meter.tariff_group_id,
    currentSession.reading_date,
  );

  if (!previousSession) {
    console.log(
      `[ReadingService] First fuel entry for meter ${meter.meter_code}. Creating initial summary with 0 consumption.`,
    );
    const initialSummaryDetails = await _calculateFuelSummary(
      tx,
      meter,
      currentSession,
      null,
      priceScheme,
    );

    const summary = await _createOrUpdateDistributedSummary(
      tx,
      meter,
      currentSession.reading_date,
      initialSummaryDetails,
    );
    return [summary];
  }

  if (previousSession.reading_date > currentSession.reading_date) {
    const formattedPrevDate = new Date(previousSession.reading_date).toLocaleDateString('id-ID');

    throw new Error400(
      `Kronologi tidak valid. Tanggal input harus setelah tanggal terakhir (${formattedPrevDate}).`,
    );
  }

  const summaryDetails = await _calculateFuelSummary(
    tx,
    meter,
    currentSession,
    previousSession,
    priceScheme,
  );

  if (summaryDetails.length === 0) {
    return [];
  }

  const summary = await _createSingleSummaryFromDetails(
    tx,
    meter.meter_id,
    currentSession.reading_date,
    summaryDetails,
  );

  if (summary) {
    await tx.summaryDetail.deleteMany({
      where: { summary_id: summary.summary_id },
    });
    await tx.summaryDetail.createMany({
      data: summaryDetails.map((detail) => {
        const { energy_type, ...rest } = detail as any;
        const energyTypeId = energy_type?.connect?.energy_type_id;

        return {
          ...rest,
          summary_id: summary.summary_id,
          energy_type_id: energyTypeId,
        };
      }),
    });
  }

  console.log(
    `[ReadingService] Created a single fuel summary for meter ${meter.meter_code} on ${currentSession.reading_date.toISOString().split('T')[0]}.`,
  );
  return summary ? [summary] : [];
};

export const _recalculateKwhTotal = async (tx: Prisma.TransactionClient, sessionId: number) => {
  const sessionDetails = await tx.readingDetail.findMany({
    where: { session_id: sessionId },
    include: { reading_type: true },
  });

  const wbpDetail = sessionDetails.find((d) => d.reading_type.type_name === 'WBP');
  const lwbpDetail = sessionDetails.find((d) => d.reading_type.type_name === 'LWBP');
  const kwhTotalType = await tx.readingType.findFirst({
    where: { type_name: 'kWh_Total' },
  });

  if (wbpDetail && lwbpDetail && kwhTotalType) {
    const newKwhTotal = new Prisma.Decimal(wbpDetail.value).plus(lwbpDetail.value);
    await tx.readingDetail.upsert({
      where: {
        session_id_reading_type_id: {
          session_id: sessionId,
          reading_type_id: kwhTotalType.reading_type_id,
        },
      },
      update: { value: newKwhTotal },
      create: {
        session_id: sessionId,
        reading_type_id: kwhTotalType.reading_type_id,
        value: newKwhTotal,
      },
    });
  }
};
