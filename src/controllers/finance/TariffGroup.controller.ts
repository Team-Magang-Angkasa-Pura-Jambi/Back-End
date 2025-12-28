import type { NextFunction, Response } from 'express';
import type { TariffGroup } from '../../generated/prisma/index.js';
import {
  tariffGroupService,
  TariffGroupService,
} from '../../services/finance/TariffGroup.service.js';
import type {
  CreateTariffGroupBody,
  GetTariffGroupQuery,
  UpdateTariffGroupBody,
} from '../../types/finance/TariffGroup.types.js';
import { BaseController } from '../../utils/baseController.js';
import { res200 } from '../../utils/response.js';

export class TariffGroupController extends BaseController<
  TariffGroup,
  CreateTariffGroupBody,
  UpdateTariffGroupBody,
  GetTariffGroupQuery,
  TariffGroupService
> {
  constructor() {
    super(tariffGroupService, 'tariffGroupId');
  }
  public findByType = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { typeId } = res.locals.validatedData.query;

    const result = await this.service.findByType(typeId);
    res200({
      res,
      message: 'Successfully retrieved latest notifications.',
      data: result,
    });
  };
}

export const tariffGroupController = new TariffGroupController();
