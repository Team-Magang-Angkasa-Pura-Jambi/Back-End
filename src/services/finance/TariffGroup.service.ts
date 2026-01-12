import prisma from '../../configs/db.js';
import type { Prisma, TariffGroup } from '../../generated/prisma/index.js';
import type { DefaultArgs } from '../../generated/prisma/runtime/library.js';
import type {
  CreateTariffGroupBody,
  UpdateTariffGroupBody,
} from '../../types/finance/TariffGroup.types.js';
import { GenericBaseService } from '../../utils/GenericBaseService.js';

export class TariffGroupService extends GenericBaseService<
  typeof prisma.tariffGroup,
  TariffGroup,
  CreateTariffGroupBody,
  UpdateTariffGroupBody,
  Prisma.TariffGroupFindManyArgs,
  Prisma.TariffGroupFindUniqueArgs,
  Prisma.TariffGroupCreateArgs,
  Prisma.TariffGroupUpdateArgs,
  Prisma.TariffGroupDeleteArgs
> {
  constructor() {
    super(prisma, prisma.tariffGroup, 'tariff_group_id');
  }

  public override async findAll(
    args?: Prisma.TariffGroupFindManyArgs<DefaultArgs>,
  ): Promise<TariffGroup[]> {
    const queryArgs = {
      ...args,
      include: {
        price_schemes: { include: { rates: true, _count: true } },
        meters: { include: { energy_type: true, _count: true } },
        _count: true,
      },
    };
    return this._handleCrudOperation(() => this._model.findMany(queryArgs));
  }

  public async findByType(typeId: number): Promise<TariffGroup[]> {
    return this._handleCrudOperation(() =>
      this._model.findMany({
        where: {
          meters: { some: { energy_type_id: typeId } },
        },
        include: {
          price_schemes: { include: { rates: true, _count: true } },
          meters: { include: { energy_type: true, _count: true } },
          _count: true,
        },
      }),
    );
  }

  public override async findById(
    id: number,
    args?: Omit<Prisma.TariffGroupFindUniqueArgs<DefaultArgs>, 'where'>,
  ): Promise<TariffGroup> {
    const queryArgs = {
      ...args,
      where: { tariff_group_id: id },
      include: {
        meters: { include: { energy_type: true } },
        price_schemes: { include: { rates: true } },
        _count: true,
      },
    };
    return this._handleCrudOperation(() => this._model.findUniqueOrThrow(queryArgs));
  }
}

export const tariffGroupService = new TariffGroupService();
