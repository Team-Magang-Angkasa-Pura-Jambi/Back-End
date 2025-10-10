// src/services/energyType.service.ts

import prisma from '../configs/db.js';
import type { EnergyType, Prisma, Meter } from '../generated/prisma/index.js';
import type { DefaultArgs } from '../generated/prisma/runtime/library.js';
import type {
  CreateEnergyTypeBody,
  GetEnergyTypesQuery,
  UpdateEnergyTypeBody,
} from '../types/energy.type.js';
import type { CustomErrorMessages } from '../utils/baseService.js';

import { GenericBaseService } from '../utils/GenericBaseService.js';

export class EnergyTypeService extends GenericBaseService<
  // PERBAIKAN: Semua tipe generik disesuaikan dengan model EnergyType
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

  public findAll(
    args?: Prisma.EnergyTypeFindManyArgs<DefaultArgs> | undefined,
    customMessages?: CustomErrorMessages
  ): Promise<
    {
      energy_type_id: number;
      type_name: string;
      unit_of_measurement: string;
      is_active: boolean;
    }[]
  > {
    const { typeName, ...restArgs } = args;
    const where: Prisma.EnergyTypeWhereInput = {};

    if (typeName) {
      where.type_name = {
        contains: typeName,
        mode: 'insensitive',
      };
    }

    // Gabungkan semua argumen menjadi satu
    const findArgs: Prisma.EnergyTypeFindManyArgs = {
      ...restArgs, // Sebarkan argumen lain seperti orderBy, take, skip
      where,
      include: {
        reading_types: true,
        meters: { select: { meter_code: true, meter_id: true } },
      },
    };

    return super.findAll(findArgs);
  }
}

export const energyTypeService = new EnergyTypeService();
