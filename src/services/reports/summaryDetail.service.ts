import prisma from '../../configs/db.js';
import type { Prisma, SummaryDetail } from '../../generated/prisma/index.js';

import type {
  CreateSummaryDetailBody,
  GetSummaryDetailQuery,
  UpdateSummaryDetailBody,
} from '../../types/reports/summaryDetail.type.js';

import { GenericBaseService } from '../../utils/GenericBaseService.js';

export class SummaryDetailService extends GenericBaseService<
  typeof prisma.summaryDetail,
  SummaryDetail,
  CreateSummaryDetailBody,
  UpdateSummaryDetailBody,
  Prisma.SummaryDetailFindManyArgs,
  Prisma.SummaryDetailFindUniqueArgs,
  Prisma.SummaryDetailCreateArgs,
  Prisma.SummaryDetailUpdateArgs,
  Prisma.SummaryDetailDeleteArgs
> {
  constructor() {
    super(prisma, prisma.summaryDetail, 'detail_id');
  }

  public override async findAll(
    query: GetSummaryDetailQuery = {}
  ): Promise<SummaryDetail[]> {
    const { month } = query;
    const where: Prisma.SummaryDetailWhereInput = {};

    if (month) {
      const year = parseInt(month.split('-')[0]);
      const monthIndex = parseInt(month.split('-')[1]) - 1;
      const startDate = new Date(Date.UTC(year, monthIndex, 1));
      const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));

      where.summary = {
        summary_date: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    const findArgs = {
      where,
      include: {
        summary: true,
        energy_type: true,
      },
      orderBy: {
        summary: {
          summary_date: 'asc',
        },
      },
    };

    return this._handleCrudOperation(() => this._model.findMany(findArgs));
  }
}

export const summaryDetailService = new SummaryDetailService();
