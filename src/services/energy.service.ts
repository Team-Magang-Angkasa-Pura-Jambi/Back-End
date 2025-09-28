// src/services/energyType.service.ts

import prisma from '../configs/db.js';
import type { EnergyType, Prisma, Meter } from '../generated/prisma/index.js';
import type {
  CreateEnergyTypeBody,
  GetEnergyTypesQuery,
  UpdateEnergyTypeBody,
} from '../types/energy.type.js';

import { GenericBaseService } from '../utils/GenericBaseService.js';

// Tipe untuk query filter kustom

// Tipe hasil query yang menyertakan relasi
type EnergyTypeWithRelations = Prisma.EnergyTypeGetPayload<{
  include: { reading_types: true; meters: true };
}>;

// Tipe untuk hasil pencarian meter
type MeterWithEnergyType = Prisma.MeterGetPayload<{
  include: { energy_type: true };
}>;

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

  /**
   * Meng-override findAll untuk selalu menyertakan relasi.
   */
  public override async findAll(
    query: GetEnergyTypesQuery = {}
  ): Promise<EnergyTypeWithRelations[]> {
    const { typeName, ...restArgs } = query;
    const where: Prisma.EnergyTypeWhereInput = {};

    // Bangun klausa 'where' secara dinamis
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
        meters: true,
      },
    };

    // Panggil metode 'findAll' dari parent dengan argumen yang sudah lengkap
    return super.findAll(findArgs);
  }

  // Metode findById, create, update, delete diwarisi dari GenericBaseService
}

export const energyTypeService = new EnergyTypeService();
