import prisma from '../../configs/db.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';
import { type EfficiencyTarget, Prisma } from '../../generated/prisma/index.js';
import type {
  CreateEfficiencyBody,
  UpdateEfficiencyBody,
} from '../../types/intelligence/efficiencyTarget.type.js';
import type { DefaultArgs } from '../../generated/prisma/runtime/library.js';
import { Error400 } from '../../utils/customError.js';
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
}

export const efficiencyTargetService = new EfficiencyTargetService();
