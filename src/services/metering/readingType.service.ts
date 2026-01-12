import prisma from '../../configs/db.js';
import { type Prisma, type ReadingType } from '../../generated/prisma/index.js';
import { type PaginationParams } from '../../types/common/index.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';
import type {
  CreateReadingTypeBody,
  UpdateReadingTypeBody,
} from '../../types/metering/readingType.type.js';
import { type CustomErrorMessages } from '../../utils/baseService.js';

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

  public async findAll(
    args?: Prisma.ReadingTypeFindManyArgs &
      PaginationParams & { meterId?: number; energyTypeId?: number },
    customMessages?: CustomErrorMessages,
  ): Promise<ReadingTypeWithEnergyType[]> {
    const { meterId, energyTypeId, ...restArgs } = args ?? {};
    const where: Prisma.ReadingTypeWhereInput = {};

    // Bangun klausa 'where' secara dinamis
    if (energyTypeId) {
      where.energy_type_id = energyTypeId;
    }

    // PERBAIKAN: Ini adalah cara yang benar untuk memfilter berdasarkan relasi
    if (meterId) {
      where.session_details = {
        some: { session: { meter_id: meterId } },
      };
    }

    const findArgs: Prisma.ReadingTypeFindManyArgs = {
      ...restArgs,
      where,
      include: {
        energy_type: true,
        applicable_to_categories: true,
      },
      orderBy: {
        reading_type_id: 'asc',
      },
    };

    const result = await super.findAll(findArgs as any, customMessages);
    return result as ReadingTypeWithEnergyType[];
  }

  // public async create(data: {
  //   type_name: string;
  //   energy_type_id: number;
  // }): Promise<{
  //   reading_type_id: number;
  //   type_name: string;
  //   reading_unit: string;
  //   energy_type_id: number;
  // }> {
  //   return this._handleCrudOperation(() => this._model.create({ data }));
  // }
}
