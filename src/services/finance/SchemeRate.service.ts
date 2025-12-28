import prisma from '../../configs/db.js';
import type { Prisma, SchemeRate } from '../../generated/prisma/index.js';
import type {
  CreateSchemeRateBody,
  UpdateSchemeRateBody,
} from '../../types/finance/SchemeRate.type.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';

export class SchemeRateService extends GenericBaseService<
  typeof prisma.schemeRate,
  SchemeRate,
  CreateSchemeRateBody,
  UpdateSchemeRateBody,
  Prisma.SchemeRateFindManyArgs,
  Prisma.SchemeRateFindUniqueArgs,
  Prisma.SchemeRateCreateArgs,
  Prisma.SchemeRateUpdateArgs,
  Prisma.SchemeRateDeleteArgs
> {
  constructor() {
    super(prisma, prisma.schemeRate, 'rate_id');
  }
}
