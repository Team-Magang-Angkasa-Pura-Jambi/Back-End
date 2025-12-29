import prisma from '../../configs/db.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';
import type { EfficiencyTarget, Prisma } from '../../generated/prisma/index.js';
import type {
  CreateEfficiencyBody,
  UpdateEfficiencyBody,
} from '../../types/intelligence/efficiencyTarget.type.js';
import type { DefaultArgs } from '../../generated/prisma/runtime/library.js';
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
    args?: Prisma.EfficiencyTargetFindManyArgs<DefaultArgs>
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
        // PERUBAHAN: Hanya pilih username dari user yang menyetel target
        set_by_user: {
          select: {
            username: true,
          },
        },
      },
    };
    return this._handleCrudOperation(() => this._model.findMany(queryArgs));
  }

  public override async create(
    data: CreateEfficiencyInternal
  ): Promise<EfficiencyTarget> {
    const { meter_id, set_by_user_id, ...restOfData } = data; // energy_type_id tidak lagi ada di sini

    const prismaData = {
      ...restOfData,

      meter: {
        connect: {
          meter_id,
        },
      },

      set_by_user: {
        connect: {
          user_id: set_by_user_id,
        },
      },
    };

    // PERUBAHAN: Tambahkan `include` untuk menyertakan data relasi dalam respons.
    return this._create({
      data: prismaData,
      include: {
        meter: true,
        // PERUBAHAN: Hanya pilih username dari user yang menyetel target
        set_by_user: {
          select: {
            username: true,
          },
        },
      },
    });
  }
}

export const efficiencyTargetService = new EfficiencyTargetService();
