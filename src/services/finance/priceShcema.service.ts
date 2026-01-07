import prisma from '../../configs/db.js';
import type { PriceScheme, Prisma } from '../../generated/prisma/index.js';
import type {
  CreatePriceSchemaBody,
  GetPriceSchemasQuery,
  UpdatePriceSchemaBody,
} from '../../types/finance/priceSchema.types.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';
import { Error400 } from '../../utils/customError.js';

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

  public override async findAll(
    query?: GetPriceSchemasQuery
  ): Promise<PriceSchemeWithRates[]> {
    const { tarifGroupId } = query || {};
    const where: Prisma.PriceSchemeScalarWhereInput = {};

    if (tarifGroupId) {
      where.tariff_group_id = tarifGroupId;
    }

    const findArgs: Prisma.PriceSchemeFindManyArgs = {
      where,
      include: {
        rates: true,
        tariff_group: true,
        taxes: { include: { tax: true } },
      },
    };

    return this._handleCrudOperation(() =>
      this._model.findMany(findArgs)
    ) as any as PriceSchemeWithRates[];
  }

  public override async create(
    data: CreatePriceSchemaInternal
  ): Promise<PriceScheme> {
    const { tariff_group_id, set_by_user_id, rates, tax_ids, ...restOfData } =
      data;

    const tariffGroupExists = await prisma.tariffGroup.findUnique({
      where: { tariff_group_id },
    });
    if (!tariffGroupExists) {
      throw new Error400(`Tariff group with ID ${tariff_group_id} not found.`);
    }

    const prismaData: Prisma.PriceSchemeCreateInput = {
      ...restOfData,
      tariff_group: {
        connect: {
          tariff_group_id: tariff_group_id,
        },
      },
      rates: {
        create: rates,
      },
      set_by_user: {
        connect: {
          user_id: set_by_user_id,
        },
      },
    };

    if (tax_ids && tax_ids.length > 0) {
      const taxCount = await prisma.tax.count({
        where: { tax_id: { in: tax_ids } },
      });
      if (taxCount !== tax_ids.length) {
        throw new Error400('One or more provided tax_ids are invalid.');
      }

      prismaData.taxes = {
        create: tax_ids.map((taxId) => ({
          tax: { connect: { tax_id: taxId } },
        })),
      };
    }

    return this._create({ data: prismaData });
  }

  public override async update(
    schemeId: number,
    data: UpdatePriceSchemaBody
  ): Promise<PriceScheme> {
    const { rates, tax_ids, ...restOfData } = data;

    return this._handleCrudOperation(async () => {
      return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updateData: Prisma.PriceSchemeUpdateInput = { ...restOfData };

        if (rates) {
          updateData.rates = {
            deleteMany: {},
            create: rates,
          };
        }

        if (tax_ids) {
          if (tax_ids.length > 0) {
            const taxCount = await tx.tax.count({
              where: { tax_id: { in: tax_ids } },
            });
            if (taxCount !== tax_ids.length) {
              throw new Error400('One or more provided tax_ids are invalid.');
            }
          }

          updateData.taxes = {
            deleteMany: {},
            create: tax_ids.map((taxId) => ({
              tax: { connect: { tax_id: taxId } },
            })),
          };
        }

        const updatedScheme = await tx.priceScheme.update({
          where: { scheme_id: schemeId },
          data: updateData,
          include: { rates: true, taxes: { include: { tax: true } } },
        });

        return updatedScheme;
      });
    });
  }
}

export const priceSchemeService = new PriceSchemeService();
