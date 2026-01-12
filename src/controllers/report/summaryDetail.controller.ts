import type { SummaryDetail } from '../../generated/prisma/index.js';
import {
  summaryDetailService,
  type SummaryDetailService,
} from '../../services/reports/summaryDetail.service.js';

import type {
  CreateSummaryDetailBody,
  SummaryDetailParams,
  UpdateSummaryDetailBody,
} from '../../types/reports/summaryDetail.type.js';
import { BaseController } from '../../utils/baseController.js';

export class SummaryDetailController extends BaseController<
  SummaryDetail,
  CreateSummaryDetailBody,
  UpdateSummaryDetailBody,
  SummaryDetailParams,
  SummaryDetailService
> {
  constructor() {
    super(summaryDetailService, 'detailId');
  }
}
