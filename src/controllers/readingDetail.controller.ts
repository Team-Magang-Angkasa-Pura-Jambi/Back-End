import { ReadingDetailService } from '../services/readingDetail.service.js';

import type {
  CreateReadingDetailBody,
  GetReadingDetailsQuery,
  UpdateReadingDetailBody,
} from '../types/readingDetail.type.js';
import { BaseController } from '../utils/baseController.js';
import type { ReadingDetail } from '../generated/prisma/index.js';

export class ReadingDetailController extends BaseController<
  ReadingDetail,
  CreateReadingDetailBody,
  UpdateReadingDetailBody,
  GetReadingDetailsQuery,
  ReadingDetailService
> {
  constructor() {
    super(new ReadingDetailService(), 'detailId');
  }
}
