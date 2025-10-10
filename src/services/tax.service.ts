import prisma from '../configs/db.js';
import type { Prisma, Tax } from '../generated/prisma/index.js';
import type { DefaultArgs } from '../generated/prisma/runtime/library.js';
import type { CreateTaxBody, UpdateTaxBody } from '../types/tax.type.js';
import type { CustomErrorMessages } from '../utils/baseService.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';
import { Error400 } from '../utils/customError.js';

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

  public override async findAll(
    args?: Prisma.TaxFindManyArgs<DefaultArgs> | undefined,
    customMessages?: CustomErrorMessages
  ): Promise<Tax[]> {
    const queryArgs: Prisma.TaxFindManyArgs = {
      ...args,
      include: {
        price_schemes: {
          include: {
            price_scheme: true,
          },
        },
        ...args?.include,
      },
    };
    return this._handleCrudOperation(() => this._model.findMany(queryArgs));
  }
}

export const taxService = new TaxService();
