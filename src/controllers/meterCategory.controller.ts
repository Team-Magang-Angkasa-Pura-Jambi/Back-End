import type {
  CreateMeterBody,
  GetMetersQuery,
  UpdateMeterBody,
} from '../types/meter.tpye.js';

import { BaseController } from '../utils/baseController.js';
import type { Meter, MeterCategory } from '../generated/prisma/index.js';
import type {
  CreateMeterCategoryBody,
  GetMeterCategoryQuery,
  UpdateMeterCategoryBody,
} from '../types/meterCategory.type.js';
import { MeterCategoryService } from '../services/meterCategory.service.js';

export class MeterCategoryController extends BaseController<
  MeterCategory,
  CreateMeterCategoryBody,
  UpdateMeterCategoryBody,
  GetMeterCategoryQuery,
  MeterCategoryService
> {
  constructor() {
    super(new MeterCategoryService(), 'categoryId');
  }
}
