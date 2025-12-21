import { MeterCategory } from "../../generated/prisma/index.js";
import { MeterCategoryService } from "../../services/metering/meterCategory.service.js";
import { CreateMeterCategoryBody, GetMeterCategoryQuery, UpdateMeterCategoryBody } from "../../types/meterCategory.type.js";
import { BaseController } from "../../utils/baseController.js";



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
