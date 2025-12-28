import type { SchemeRate } from '../../generated/prisma/index.js';
import { SchemeRateService } from '../../services/finance/SchemeRate.service.js';
import type {
  CreateSchemeRateBody,
  GetSchemeRateQuery,
  UpdateSchemeRateBody,
} from '../../types/finance/SchemeRate.type.js';
import { BaseController } from '../../utils/baseController.js';

export class SchemeRateController extends BaseController<
  SchemeRate,
  CreateSchemeRateBody,
  UpdateSchemeRateBody,
  GetSchemeRateQuery,
  SchemeRateService
> {
  constructor() {
    super(new SchemeRateService(), 'rateId');
  }
}
