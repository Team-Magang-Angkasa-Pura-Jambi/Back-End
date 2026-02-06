import prisma from '../../configs/db.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';
import { type EfficiencyTarget, Prisma } from '../../generated/prisma/index.js';
import type {
  CreateEfficiencyBody,
  UpdateEfficiencyBody,
} from '../../types/intelligence/efficiencyTarget.type.js';
import type { DefaultArgs } from '../../generated/prisma/runtime/library.js';
import { Error400, Error404 } from '../../utils/customError.js';
import { differenceInDays } from 'date-fns';
type CreateEfficiencyInternal = CreateEfficiencyBody & {
  set_by_user_id: number;
};
export class EfficiencyTargetService extends GenericBaseService<
  typeof prisma.efficiencyTarget,
  EfficiencyTarget,
  CreateEfficiencyBody,
  UpdateEfficiencyBody,
  Prisma.EfficiencyTargetFindManyArgs,
  Prisma.EfficiencyTargetFindUniqueArgs,
  Prisma.EfficiencyTargetCreateArgs,
  Prisma.EfficiencyTargetUpdateArgs,
  Prisma.EfficiencyTargetDeleteArgs
> {
  constructor() {
    super(prisma, prisma.efficiencyTarget, 'target_id');
  }

  public override async findAll(
    args?: Prisma.EfficiencyTargetFindManyArgs<DefaultArgs>,
  ): Promise<EfficiencyTarget[]> {
    const queryArgs = {
      ...args,
      include: {
        meter: {
          select: {
            meter_code: true,
            energy_type: {
              select: { type_name: true, unit_of_measurement: true },
            },
          },
        },

        set_by_user: {
          select: {
            username: true,
          },
        },
      },
    };
    return this._handleCrudOperation(() => this._model.findMany(queryArgs));
  }

  public override async create(data: CreateEfficiencyInternal): Promise<EfficiencyTarget> {
    const {
      meter_id,
      set_by_user_id,
      period_start,
      period_end,
      target_value, // Ini adalah nilai target (misal: 100 kWh)
      ...restOfData
    } = data;

    return this._handleCrudOperation(async () => {
      // 1. Normalisasi Tanggal
      const isoStart = new Date(period_start);
      isoStart.setUTCHours(0, 0, 0, 0);
      const isoEnd = new Date(period_end);
      isoEnd.setUTCHours(23, 59, 59, 999);

      if (isNaN(isoStart.getTime()) || isNaN(isoEnd.getTime())) {
        throw new Error400('Format tanggal periode tidak valid.');
      }

      // 2. Ambil Skema Harga Aktif untuk Meter tersebut
      const meter = await prisma.meter.findUnique({
        where: { meter_id },
        include: {
          energy_type: true,
          tariff_group: {
            include: {
              price_schemes: {
                where: {
                  is_active: true,
                  effective_date: { lte: isoStart }, // Skema yang berlaku saat periode mulai
                },
                include: {
                  rates: { include: { reading_type: true } },
                },
                orderBy: { effective_date: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      if (!meter || !meter.tariff_group?.price_schemes[0]) {
        throw new Error400('Skema harga aktif tidak ditemukan untuk meter ini.');
      }

      const activeScheme = meter.tariff_group.price_schemes[0];
      let avgPricePerUnit = new Prisma.Decimal(0);

      // 3. Logika Kalkulasi Rata-rata Harga (WBP & LWBP untuk Listrik)
      if (meter.energy_type.type_name === 'Electricity') {
        const wbpRate =
          activeScheme.rates.find((r) => r.reading_type.type_name === 'WBP')?.value ?? 0;
        const lwbpRate =
          activeScheme.rates.find((r) => r.reading_type.type_name === 'LWBP')?.value ?? 0;

        // Rata-rata harga = (WBP + LWBP) / 2
        avgPricePerUnit = new Prisma.Decimal(wbpRate).plus(lwbpRate).div(2);
      } else {
        // Untuk Air/BBM biasanya hanya ada satu tarif utama
        avgPricePerUnit = new Prisma.Decimal(activeScheme.rates[0]?.value || 0);
      }

      // 4. Hitung Estimasi Total Cost
      // Total Cost = Target Value * Rata-rata Harga
      const estimatedTotalCost = new Prisma.Decimal(target_value).mul(avgPricePerUnit);

      // 5. Simpan ke Database
      return prisma.efficiencyTarget.create({
        data: {
          ...restOfData,
          target_value,
          target_cost: estimatedTotalCost, // Sekarang sudah terisi
          period_start: isoStart,
          period_end: isoEnd,
          meter_id,
          set_by_user_id,
        },
        include: {
          meter: {
            include: { energy_type: true },
          },
          set_by_user: {
            select: { username: true },
          },
        },
      });
    });
  }

  public async getEfficiencyTargetPreview(data: {
    target_value: number;
    meterId: number;
    periodStartDate: Date;
    periodEndDate: Date;
  }) {
    return this._handleCrudOperation(async () => {
      const { target_value, meterId, periodStartDate, periodEndDate } = data;

      if (periodEndDate < periodStartDate) {
        throw new Error400('Tanggal akhir tidak boleh sebelum tanggal mulai.');
      }
      const totalDays = differenceInDays(periodEndDate, periodStartDate) + 1;
      if (totalDays <= 0) {
        throw new Error400('Periode tidak valid, tanggal akhir harus setelah tanggal mulai.');
      }

      const meter = await prisma.meter.findUnique({
        where: { meter_id: meterId },
        include: {
          energy_type: true,
          tariff_group: {
            include: {
              price_schemes: {
                where: { is_active: true },
                include: { rates: { include: { reading_type: true } } },
                orderBy: { effective_date: 'desc' },
              },
            },
          },
        },
      });

      if (!meter) {
        throw new Error404(`Meter dengan ID ${meterId} tidak ditemukan.`);
      }

      const activePriceScheme = meter.tariff_group?.price_schemes[0];
      if (!activePriceScheme) {
        throw new Error404(
          `Tidak ada skema harga aktif yang ditemukan untuk golongan tarif meter '${meter.meter_code}'.`,
        );
      }

      let avgPricePerUnit: Prisma.Decimal;
      if (meter.energy_type.type_name === 'Electricity') {
        const wbpRate = activePriceScheme.rates.find(
          (r: any) => r.reading_type.type_name === 'WBP',
        )?.value;
        const lwbpRate = activePriceScheme.rates.find(
          (r: any) => r.reading_type.type_name === 'LWBP',
        )?.value;

        if (!wbpRate || !lwbpRate) {
          throw new Error400(
            'Skema harga untuk Listrik tidak lengkap. Tarif WBP atau LWBP tidak ditemukan.',
          );
        }

        avgPricePerUnit = wbpRate.plus(lwbpRate).div(2);
      } else {
        const singleRate = activePriceScheme.rates[0]?.value;
        if (!singleRate) {
          throw new Error400(
            `Skema harga untuk ${meter.energy_type.type_name} tidak memiliki tarif yang terdefinisi.`,
          );
        }
        avgPricePerUnit = singleRate;
      }

      if (avgPricePerUnit.isZero()) {
        throw new Error400(
          'Harga rata-rata per unit adalah nol. Tidak dapat menghitung target dari anggaran.',
        );
      }

      const inputTotalKwh = new Prisma.Decimal(target_value).times(totalDays);
      const estimatedTotalCost = inputTotalKwh.times(avgPricePerUnit);

      const budgetAllocation = await prisma.budgetAllocation.findFirst({
        where: {
          meter_id: meterId,
          budget: {
            parent_budget_id: { not: null },
            period_start: { lte: periodEndDate },
            period_end: { gte: periodStartDate },
          },
        },
        include: { budget: { include: { parent_budget: true } } },
      });

      let budgetInfo: object | null = null;
      let suggestion: object | null = null;

      if (budgetAllocation) {
        const allocatedBudgetForMeter = budgetAllocation.budget.total_budget.times(
          budgetAllocation.weight,
        );

        budgetInfo = {
          budgetId: budgetAllocation.budget_id,
          budgetPeriodStart: budgetAllocation.budget.period_start,
          budgetPeriodEnd: budgetAllocation.budget.period_end,
          meterAllocationWeight: budgetAllocation.weight.toNumber(),
          allocatedBudgetForMeter: allocatedBudgetForMeter.toNumber(),

          realizationToDate: 0,
          remainingBudget: allocatedBudgetForMeter.toNumber(),
        };

        const realizationEndDate = new Date(periodStartDate);
        realizationEndDate.setUTCDate(realizationEndDate.getUTCDate() - 1);

        let remainingBudget = allocatedBudgetForMeter;
        let realizedCost = new Prisma.Decimal(0);

        if (realizationEndDate >= budgetAllocation.budget.period_start) {
          const realizationResult = await prisma.dailySummary.aggregate({
            _sum: { total_cost: true },
            where: {
              meter_id: meterId,
              summary_date: {
                gte: budgetAllocation.budget.period_start,
                lte: realizationEndDate,
              },
            },
          });

          realizedCost = realizationResult._sum.total_cost ?? new Prisma.Decimal(0);
          remainingBudget = allocatedBudgetForMeter.minus(realizedCost);

          (budgetInfo as any).realizationToDate = realizedCost.toNumber();
          (budgetInfo as any).remainingBudget = remainingBudget.toNumber();
        }

        const childBudget = budgetAllocation.budget;
        const childPeriodDays =
          differenceInDays(childBudget.period_end, childBudget.period_start) + 1;

        const childPeriodMonths =
          (childBudget.period_end.getUTCFullYear() - childBudget.period_start.getUTCFullYear()) *
            12 +
          (childBudget.period_end.getUTCMonth() - childBudget.period_start.getUTCMonth()) +
          1;

        const dailyBudgetForMeter = allocatedBudgetForMeter.div(childPeriodDays);

        const suggestedDailyKwh = dailyBudgetForMeter.div(avgPricePerUnit);

        suggestion = {
          standard: {
            message: `Berdasarkan alokasi anggaran periode ini, target harian Anda adalah sekitar ${suggestedDailyKwh.toDP(2).toString()} ${meter.energy_type.unit_of_measurement}.`,
            suggestedDailyKwh: suggestedDailyKwh.toNumber(),
            suggestedTotalKwh: suggestedDailyKwh.times(totalDays).toNumber(),
          },
        };
      }

      return {
        input: {
          ...data,
        },
        budget: budgetInfo,
        preview: {
          totalDays,
          unitOfMeasurement: meter.energy_type.unit_of_measurement,
          avgPricePerUnit: avgPricePerUnit.toNumber(),
          inputTotalKwh: inputTotalKwh.toNumber(),
          estimatedTotalCost: estimatedTotalCost.toNumber(),
        },
        suggestion,
      };
    });
  }
}

export const efficiencyTargetService = new EfficiencyTargetService();
