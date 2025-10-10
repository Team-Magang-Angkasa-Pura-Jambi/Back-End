import type { Request, Response } from 'express';
import type { DailySummary, SummaryDetail } from '../generated/prisma/index.js';
import {
  summaryDetailService,
  SummaryDetailService,
} from '../services/summaryDetail.service.js';

import type {
  CreateSummaryDetailBody,
  SummaryDetailParams,
  UpdateSummaryDetailBody,
} from '../types/summaryDetail.type.js';
import { BaseController } from '../utils/baseController.js';

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
