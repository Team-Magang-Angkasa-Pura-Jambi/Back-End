import prisma from '../configs/db.js';
import type { MeterCategory, Prisma } from '../generated/prisma/index.js';
import type { DefaultArgs } from '../generated/prisma/runtime/library.js';
import type {
  CreateMeterCategoryBody,
  UpdateMeterCategoryBody,
} from '../types/meterCategory.type.js';
import type { CustomErrorMessages } from '../utils/baseService.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';

export class MeterCategoryService extends GenericBaseService<
  typeof prisma.meterCategory,
  MeterCategory,
  CreateMeterCategoryBody,
  UpdateMeterCategoryBody,
  Prisma.MeterFindManyArgs,
  Prisma.MeterFindUniqueArgs,
  Prisma.MeterCreateArgs,
  Prisma.MeterUpdateArgs,
  Prisma.MeterDeleteArgs
> {
  constructor() {
    super(prisma, prisma.meterCategory, 'category_id');
  }

  public findAll(
    args?: Prisma.MeterFindManyArgs<DefaultArgs> | undefined,
    customMessages?: CustomErrorMessages
  ): Promise<MeterCategory[]> {
    const findArgs: Prisma.MeterCategoryFindManyArgs = {
      //   where,
      // PERBAIKAN UTAMA: Selalu sertakan relasi energy_type
      include: {
        // energy_type: true,
        // category: true,
        allowed_reading_types: true,
        meters: true,
        _count: true,
      },
      orderBy: {
        // meter_id: 'asc',
      },
    };

    return this._handleCrudOperation(() => this._model.findMany(findArgs));
  }
}
