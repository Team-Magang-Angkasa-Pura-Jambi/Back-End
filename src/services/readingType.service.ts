import prisma from '../configs/db.js';
import { Prisma, type ReadingType } from '../generated/prisma/index.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';
import type {
  CreateReadingTypeBody,
  GetReadingTypesQuery,
  UpdateReadingTypeBody,
} from '../types/readingType.type.js';
import type { GetQueryLastReading } from '../types/reading.types.js';

type ReadingTypeWithEnergyType = Prisma.ReadingTypeGetPayload<{
  include: { energy_type: true };
}>;

export class ReadingTypeService extends GenericBaseService<
  typeof prisma.readingType,
  ReadingType,
  CreateReadingTypeBody,
  UpdateReadingTypeBody,
  Prisma.ReadingTypeFindManyArgs,
  Prisma.ReadingTypeFindUniqueArgs,
  Prisma.ReadingTypeCreateArgs,
  Prisma.ReadingTypeUpdateArgs,
  Prisma.ReadingTypeDeleteArgs
> {
  constructor() {
    super(prisma, prisma.readingType, 'reading_type_id');
  }

  public override async findAll(
    query: GetReadingTypesQuery = {}
  ): Promise<ReadingTypeWithEnergyType[]> {
    const { meterId, energyTypeId } = query;
    const where: Prisma.ReadingTypeWhereInput = {};

    // Bangun klausa 'where' secara dinamis
    if (energyTypeId) {
      where.energy_type_id = energyTypeId;
    }

    // PERBAIKAN: Ini adalah cara yang benar untuk memfilter berdasarkan relasi
    if (meterId) {
      where.details = {
        some: {
          session: {
            meter_id: meterId,
          },
        },
      };
    }

    const findArgs: Prisma.ReadingTypeFindManyArgs = {
      where,
      include: {
        energy_type: true, // Selalu sertakan relasi energy_type
      },
      orderBy: {
        reading_type_id: 'asc',
      },
    };

    return this._handleCrudOperation(() => this._model.findMany(findArgs));
  }
}
