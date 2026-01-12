import type {
  CreateMeterBody,
  GetMetersQuery,
  UpdateMeterBody,
} from '../../types/metering/meter.type.js';

import { BaseController } from '../../utils/baseController.js';
import { MeterService } from '../../services/metering/meter.service.js';
import type { Meter } from '../../generated/prisma/index.js';
import { type Request, type Response } from 'express';
import { Error401 } from '../../utils/customError.js';
import { res200 } from '../../utils/response.js';

export class MeterController extends BaseController<
  Meter,
  CreateMeterBody,
  UpdateMeterBody,
  GetMetersQuery,
  MeterService
> {
  constructor() {
    super(new MeterService(), 'meterId');
  }

  public override getAll = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      throw Error401;
    }

    const query = res.locals.validatedData.query;
    const result = await this.service.findAllwithRole(userId, query);

    res200({ res, message: 'Berhasil mengambil semua data.', data: result });
  };
}
