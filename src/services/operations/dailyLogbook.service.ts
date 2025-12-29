import {
  DailySummary,
  EfficiencyTarget,
  Prisma,
  SummaryDetail,
} from '../../generated/prisma/index.js';
import prisma from '../../configs/db.js';
import type {
  CreateDailyLogbookBody,
  DailyLogbook,
  GetLogbooksQuery,
  UpdateDailyLogbookBody,
} from '../../types/operations/dailyLogbook.type.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';

type SummaryWithRelations = Prisma.DailySummaryGetPayload<{
  select: {
    summary_id: true;
    total_consumption: true;
    total_cost: true;
    meter: {
      select: {
        meter_id: true;
        meter_code: true;
        energy_type: { select: { type_name: true; unit_of_measurement: true } };
      };
    };
    classification:
      | {
          select: { classification: true };
        }
      | undefined;
  };
}>;

/**
 * Helper untuk menghitung persentase perubahan.
 * @param current - Nilai saat ini.
 * @param previous - Nilai sebelumnya.
 * @returns Persentase perubahan. Mengembalikan 0 jika nilai sebelumnya adalah 0.
 */
function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100.0 : 0.0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Helper untuk membuat kalimat ringkasan.
 * @param change - Nilai perubahan persentase.
 * @param metricName - Nama metrik (e.g., "listrik").
 * @returns Kalimat deskriptif.
 */
function formatChange(change: number, metricName: string): string {
  if (change > 0) {
    return `kenaikan ${metricName} sebesar ${change.toFixed(1)}%`;
  }
  if (change < 0) {
    return `penurunan ${metricName} sebesar ${Math.abs(change).toFixed(1)}%`;
  }
  return `penggunaan ${metricName} stabil`;
}

/**
 * BARU: Menormalkan tanggal ke awal hari (00:00:00) di zona waktu Asia/Jakarta.
 * Ini penting untuk memastikan konsistensi query tanggal terlepas dari zona waktu server.
 * @param date - Objek Date atau string tanggal.
 * @returns Objek Date baru yang sudah dinormalisasi ke UTC berdasarkan tanggal di Jakarta.
 */
function normalizeToJakartaDate(date: Date | string): Date {
  const d = new Date(date);

  const year = d.toLocaleString('en-US', {
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
  const month = d.toLocaleString('en-US', {
    month: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
  const day = d.toLocaleString('en-US', {
    day: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

export class DailyLogbookService extends GenericBaseService<
  typeof prisma.dailyLogbook,
  DailyLogbook,
  CreateDailyLogbookBody,
  UpdateDailyLogbookBody,
  Prisma.DailyLogbookFindManyArgs,
  Prisma.DailyLogbookFindUniqueArgs,
  Prisma.DailyLogbookCreateArgs,
  Prisma.DailyLogbookUpdateArgs,
  Prisma.DailyLogbookDeleteArgs
> {
  constructor() {
    super(prisma, prisma.dailyLogbook, 'log_id');
  }

  /**
   * Mengambil semua logbook harian dengan paginasi dan filter tanggal.
   */

  public async findAllPaginated(
    query: GetLogbooksQuery
  ): Promise<{ data: DailyLogbook[]; meta: any }> {
    const { limit, page, startDate, endDate, date } = query;

    const where: Prisma.DailyLogbookWhereInput = {};

    if (date) {
      const targetDate = new Date(date);
      targetDate.setUTCHours(0, 0, 0, 0);
      where.log_date = targetDate;
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      where.log_date = { gte: start, lte: end };
    }

    const findArgs: Prisma.DailyLogbookFindManyArgs = {
      where,
      include: {
        meter: {
          select: {
            energy_type: { select: { type_name: true } },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { log_date: 'desc' },
    };

    const [total, data] = await this._prisma.$transaction([
      this._model.count({ where }),
      this._model.findMany(findArgs),
    ]);

    return {
      data,

      meta: { total, page, limit, last_page: Math.ceil(total / (limit || 1)) },
    };
  }

  /**
   * Menghasilkan logbook harian otomatis untuk tanggal yang ditentukan.
   * Fungsi ini akan membandingkan data dengan H-1.
   * @param date - Tanggal log yang akan dibuat.
   */
  public async generateDailyLog(date: Date) {
    return this._handleCrudOperation(async () => {
      const targetDate = normalizeToJakartaDate(date);

      const previousDate = new Date(targetDate);
      previousDate.setUTCDate(targetDate.getUTCDate() - 1);

      console.log(
        `[DailyLog] Generating log for ${targetDate.toISOString()} by comparing with ${previousDate.toISOString()}`
      );

      const { todaySummaries, yesterdaySummaries, efficiencyTargets } =
        await this._fetchDataForLogGeneration(targetDate, previousDate);

      if (todaySummaries.length === 0) {
        console.log(
          `[DailyLog] Tidak ada DailySummary untuk tanggal ${targetDate.toISOString()}. Tidak ada log yang dibuat.`
        );
        return [];
      }

      const createdLogs = [];
      for (const summary of todaySummaries) {
        const previousSummary = yesterdaySummaries.find(
          (s: any) => s.meter.meter_id === summary.meter.meter_id
        );
        const target = efficiencyTargets.find(
          (t: EfficiencyTarget) => t.meter_id === summary.meter.meter_id
        );

        const finalLogData = this._analyzeSingleSummary(
          targetDate,
          summary,
          previousSummary,
          target
        );

        const createdLog = await this._prisma.dailyLogbook.upsert({
          where: {
            log_date_meter_id: {
              log_date: targetDate,
              meter_id: summary.meter.meter_id,
            },
          },
          update: finalLogData,
          create: finalLogData,
        });

        createdLogs.push(createdLog);
      }

      console.log(
        `[DailyLog] Successfully generated/updated ${createdLogs.length} logs.`
      );
      return createdLogs;
    });
  }

  /**
   * BARU: Mengambil semua data yang diperlukan untuk pembuatan logbook.
   */
  private async _fetchDataForLogGeneration(
    targetDate: Date,
    previousDate: Date
  ) {
    const [todaySummaries, yesterdaySummaries, efficiencyTargets] =
      await Promise.all([
        this._prisma.dailySummary.findMany({
          where: { summary_date: targetDate },

          include: {
            meter: {
              select: {
                meter_id: true,
                meter_code: true,
                energy_type: {
                  select: { type_name: true, unit_of_measurement: true },
                },
              },
            },
            classification: {
              select: {
                classification: true,
              },
            },
          },
        }),
        this._prisma.dailySummary.findMany({
          where: { summary_date: previousDate },

          select: {
            summary_id: true,
            total_consumption: true,
            total_cost: true,
            meter: { select: { meter_id: true } },
            classification: { select: { classification: true } },
          },
        }),
        this._prisma.efficiencyTarget.findMany({
          where: {
            period_start: { lte: targetDate },
            period_end: { gte: targetDate },
          },
          include: { meter: { select: { tariff_group: true } } },
        }),
      ]);

    return { todaySummaries, yesterdaySummaries, efficiencyTargets };
  }

  /**
   * BARU: Menganalisis satu DailySummary dan menghasilkan data untuk DailyLogbook.
   */
  private _analyzeSingleSummary(
    logDate: Date,
    summary: SummaryWithRelations,
    previousSummary: SummaryWithRelations | undefined,
    target:
      | Prisma.EfficiencyTargetGetPayload<{
          include: { meter: { select: { tariff_group: true } } };
        }>
      | undefined
  ): Prisma.DailyLogbookCreateInput {
    const { meter } = summary;

    const { logData, savingsSummary, targetDeviationPercent } =
      this._calculateSavingsAndOverage(summary, previousSummary, target);

    let classificationNote = '';
    if (summary.classification) {
      classificationNote = ` Perilaku pemakaian diklasifikasikan sebagai **${summary.classification.classification}**.`;
    }

    const summaryNotes = `Ringkasan untuk meter ${
      meter.meter_code
    }: ${savingsSummary}${classificationNote}`;

    return {
      ...logData,
      log_date: logDate,
      meter: { connect: { meter_id: meter.meter_id } },
      consumption_change_percent: targetDeviationPercent
        ? new Prisma.Decimal(targetDeviationPercent)
        : null,
      summary_notes: summaryNotes,
    };
  }

  /**
   * BARU: Menghitung penghematan/pemborosan dan mengembalikan data log & ringkasan.
   */
  private _calculateSavingsAndOverage(
    summary: SummaryWithRelations,
    previousSummary: SummaryWithRelations | undefined,
    target:
      | Prisma.EfficiencyTargetGetPayload<{
          include: { meter: { select: { tariff_group: true } } };
        }>
      | undefined
  ) {
    const logData: Partial<Prisma.DailyLogbookCreateInput> = {};
    let savingsSummary =
      'Tidak ada target efisiensi yang ditetapkan untuk hari ini.';
    let targetDeviationPercent: number | null = null;

    if (target) {
      const targetValue = target.target_value.toNumber();
      const consumption = summary.total_consumption?.toNumber() ?? 0;
      const actualCost = summary.total_cost?.toNumber() ?? 0;
      let estimatedTargetCost: number;

      if (targetValue > 0) {
        targetDeviationPercent =
          ((consumption - targetValue) / targetValue) * 100;
      }

      if (target.target_cost) {
        estimatedTargetCost = target.target_cost.toNumber();
      } else {
        const consumptionYesterday =
          previousSummary?.total_consumption?.toNumber() ?? 0;
        const costYesterday = previousSummary?.total_cost?.toNumber() ?? 0;
        const avgPricePerUnit =
          consumptionYesterday > 0 ? costYesterday / consumptionYesterday : 0;
        const faktorKali = target.meter.tariff_group?.faktor_kali ?? 1;
        estimatedTargetCost = targetValue * faktorKali * avgPricePerUnit;
      }

      if (consumption < targetValue) {
        logData.savings_value = new Prisma.Decimal(targetValue - consumption);
        logData.savings_cost = new Prisma.Decimal(
          Math.max(0, estimatedTargetCost - actualCost)
        );
        savingsSummary = `Tercapai penghematan sebesar ${logData.savings_value.toFixed(
          2
        )} ${summary.meter.energy_type.unit_of_measurement} (${Math.abs(
          targetDeviationPercent ?? 0
        ).toFixed(
          1
        )}% di bawah target), setara dengan estimasi penghematan biaya Rp ${logData.savings_cost.toFixed(
          0
        )}.`;
      } else {
        logData.overage_value = new Prisma.Decimal(consumption - targetValue);
        logData.overage_cost = new Prisma.Decimal(
          Math.max(0, actualCost - estimatedTargetCost)
        );
        savingsSummary = `Terjadi pemborosan sebesar ${logData.overage_value.toFixed(
          2
        )} ${summary.meter.energy_type.unit_of_measurement} (${Math.abs(
          targetDeviationPercent ?? 0
        ).toFixed(
          1
        )}% di atas target), setara dengan estimasi pemborosan biaya Rp ${logData.overage_cost.toFixed(
          0
        )}.`;
      }
    }

    return { logData, savingsSummary, targetDeviationPercent };
  }
}

export const dailyLogbookService = new DailyLogbookService();
