import prisma from '../configs/db.js';
import type { Prisma, Tax } from '../generated/prisma/index.js';
import type { CreateTaxBody, UpdateTaxBody } from '../types/tax.type.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';

export class TaxService extends GenericBaseService<
  typeof prisma.tax,
  Tax,
  CreateTaxBody,
  UpdateTaxBody,
  Prisma.TaxFindManyArgs,
  Prisma.TaxFindUniqueArgs,
  Prisma.TaxCreateArgs,
  Prisma.TaxUpdateArgs,
  Prisma.TaxDeleteArgs
> {
  constructor() {
    super(prisma, prisma.tax, 'tax_id');
  }
}
