import prisma from '../configs/db.js';
import type { PriceScheme, Prisma } from '../generated/prisma/index.js';
import type {
  CreatePriceSchemaBody,
  UpdatePriceSchemaBody,
} from '../types/priceSchema.types.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';

type PriceSchemeWithRates = Prisma.PriceSchemeGetPayload<{
  include: { rates: true };
}>;

type CreatePriceSchemaInternal = CreatePriceSchemaBody & {
  set_by_user_id: number;
};

export class PriceSchemeService extends GenericBaseService<
  typeof prisma.priceScheme,
  PriceScheme,
  CreatePriceSchemaBody,
  UpdatePriceSchemaBody,
  Prisma.PriceSchemeFindManyArgs,
  Prisma.PriceSchemeFindUniqueArgs,
  Prisma.PriceSchemeCreateArgs,
  Prisma.PriceSchemeUpdateArgs,
  Prisma.PriceSchemeDeleteArgs
> {
  constructor() {
    super(prisma, prisma.priceScheme, 'scheme_id');
  }

  public override async findAll(): Promise<PriceSchemeWithRates[]> {
    return this._handleCrudOperation(() =>
      this._model.findMany({
        include: {
          rates: true,
        },
      })
    );
  }

  public override async create(
    data: CreatePriceSchemaInternal
  ): Promise<PriceScheme> {
    const { energy_type_id, set_by_user_id, ...restOfData } = data;

    const prismaData = {
      ...restOfData,

      energy_type: {
        connect: {
          energy_type_id: energy_type_id,
        },
      },

      set_by_user: {
        connect: {
          user_id: set_by_user_id,
        },
      },
    };

    return this._create({ data: prismaData });
  }
}
