import prisma from '../../configs/db.js';
import type { MeterCategory, Prisma } from '../../generated/prisma/index.js';
import type {
  CreateMeterCategoryBody,
  UpdateMeterCategoryBody,
} from '../../types/metering/meterCategory.type.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';

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

  public override async findById(
    id: number
  ): Promise<{ name: string; category_id: number }> {
    return this._handleCrudOperation(() =>
      this._model.findUniqueOrThrow({
        where: { category_id: id },
        include: {
          meters: true,
          _count: true,
        },
      })
    );
  }
}
