import prisma from '../../configs/db.js';
import type { EnergyType, Prisma } from '../../generated/prisma/index.js';
import { type PaginationParams } from '../../types/common/index.js';
import type {
  CreateEnergyTypeBody,
  UpdateEnergyTypeBody,
} from '../../types/metering/energy.type.js';
import type { CustomErrorMessages } from '../../utils/baseService.js';

import { GenericBaseService } from '../../utils/GenericBaseService.js';

export class EnergyTypeService extends GenericBaseService<
  typeof prisma.energyType,
  EnergyType,
  CreateEnergyTypeBody,
  UpdateEnergyTypeBody,
  Prisma.EnergyTypeFindManyArgs,
  Prisma.EnergyTypeFindUniqueArgs,
  Prisma.EnergyTypeCreateArgs,
  Prisma.EnergyTypeUpdateArgs,
  Prisma.EnergyTypeDeleteArgs
> {
  constructor() {
    super(prisma, prisma.energyType, 'energy_type_id');
  }
  public override async findAll(
    args?: Prisma.EnergyTypeFindManyArgs & PaginationParams & { typeName?: string },
    customMessages?: CustomErrorMessages,
  ): Promise<EnergyType[]> {
    const { typeName, ...restArgs } = args ?? {};

    const where: Prisma.EnergyTypeWhereInput = {
      ...(restArgs as any).where,
    };

    if (typeName) {
      where.type_name = {
        contains: typeName,
        mode: 'insensitive',
      };
    }
    where.meters = { some: { status: 'Active' } };

    const findArgs = {
      ...restArgs,
      where,
      include: {
        ...(restArgs as any).include,

        reading_types: true,
        meters: {
          where: { status: 'Active' },
          select: { meter_code: true, meter_id: true },
        },
      },
    };

    return super.findAll(findArgs as any, customMessages);
  }
}

export const energyTypeService = new EnergyTypeService();
