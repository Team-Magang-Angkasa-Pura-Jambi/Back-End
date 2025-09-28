import prisma from '../configs/db.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';
import type { EfficiencyTarget, Prisma } from '../generated/prisma/index.js';
import type {
  CreateEfficiencyBody,
  UpdateEfficiencyBody,
} from '../types/efficiencyTarget.type.js';
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

  public override async create(
    data: CreateEfficiencyInternal
  ): Promise<EfficiencyTarget> {
    const { energy_type_id, set_by_user_id, ...restOfData } = data;

    const prismaData = {
      ...restOfData,

      energy_type: {
        connect: {
          energy_type_id: energy_type_id,
        },
      },

      set_by_user: {
        connect: {
          user_id: set_by_user_id,
        },
      },
    };

    return this._create({ data: prismaData });
  }
}
