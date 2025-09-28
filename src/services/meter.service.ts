import prisma from '../configs/db.js';
import type { $Enums, Meter, Prisma } from '../generated/prisma/index.js';
import type { DefaultArgs } from '../generated/prisma/runtime/library.js';
import type {
  CreateMeterBody,
  GetMetersQuery,
  UpdateMeterBody,
} from '../types/meter.tpye.js';
import type { CustomErrorMessages } from '../utils/baseService.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';

// 1. Definisikan tipe untuk query filter yang sederhana
type MeterQuery = Prisma.MeterFindManyArgs & GetMetersQuery;

// Definisikan tipe hasil query yang menyertakan relasi energy_type
type MeterWithEnergyType = Prisma.MeterGetPayload<{
  include: { energy_type: true };
}>;

export class MeterService extends GenericBaseService<
  typeof prisma.meter,
  Meter,
  CreateMeterBody,
  UpdateMeterBody,
  Prisma.MeterFindManyArgs,
  Prisma.MeterFindUniqueArgs,
  Prisma.MeterCreateArgs,
  Prisma.MeterUpdateArgs,
  Prisma.MeterDeleteArgs
> {
  private readonly _include = {
    energy_type: true,
  };

  constructor() {
    super(prisma, prisma.meter, 'meter_id');
  }

  public override async findAll(
    query: MeterQuery = {}
  ): Promise<MeterWithEnergyType[]> {
    const { energyTypeId, typeName } = query;
    const where: Prisma.MeterWhereInput = {};

    // Bangun klausa 'where' secara dinamis
    if (energyTypeId) {
      where.energy_type_id = energyTypeId;
    }
    if (typeName) {
      where.energy_type = {
        type_name: {
          contains: typeName,
          mode: 'insensitive',
        },
      };
    }

    const findArgs: Prisma.MeterFindManyArgs = {
      where,
      // PERBAIKAN UTAMA: Selalu sertakan relasi energy_type
      include: {
        energy_type: true,
      },
      orderBy: {
        meter_id: 'asc',
      },
    };

    return this._handleCrudOperation(() => this._model.findMany(findArgs));
  }
}
