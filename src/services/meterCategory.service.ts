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

  public findById(
    id: number,
    args?: Omit<Prisma.MeterFindUniqueArgs<DefaultArgs>, 'where'> | undefined,
    customMessages?: CustomErrorMessages
  ): Promise<{ name: string; category_id: number }> {
    return prisma.meterCategory.findUniqueOrThrow({
      where: { category_id: id },
      include: {
        meters: true,
        _count: true,
      },
    });
  }
}
