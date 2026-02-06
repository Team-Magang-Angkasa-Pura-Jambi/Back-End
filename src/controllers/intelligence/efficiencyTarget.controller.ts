// src/controllers/efficiencyTarget.controller.ts

import { BaseController } from '../../utils/baseController.js';
import { EfficiencyTargetService } from '../../services/intelligence/efficiencyTarget.service.js';
import type { EfficiencyTarget } from '../../generated/prisma/index.js';
import type {
  CreateEfficiencyBody,
  GetEfficiencyQuery,
  UpdateEfficiencyBody,
} from '../../types/intelligence/efficiencyTarget.type.js';
import type { NextFunction, Request, Response } from 'express';
import { res200 } from '../../utils/response.js';

export class EfficiencyTargetController extends BaseController<
  EfficiencyTarget,
  CreateEfficiencyBody,
  UpdateEfficiencyBody,
  GetEfficiencyQuery,
  EfficiencyTargetService
> {
  constructor() {
    super(new EfficiencyTargetService(), 'targetId');
  }
  public override create = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    const dataWithUser = {
      ...req.body,
      set_by_user_id: userId, // Pastikan nama field ini cocok dengan skema Zod/Prisma Anda
    };

    const newRecord = await this.service.create(dataWithUser);

    res200({ res, message: 'success', data: newRecord });
  };

  public getEfficiencyTargetPreview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { target_value, meter_id, period_start, period_end } = res.locals.validatedData.body;
      const result = await this.service.getEfficiencyTargetPreview({
        target_value,
        meterId: meter_id,
        periodStartDate: period_start,
        periodEndDate: period_end,
      });

      res200({
        res,
        data: result,
        message: `Pratinjau target efisiensi berhasil dihitung.`,
      });
    } catch (error) {
      next(error);
    }
  };
}
export const efficiencyTargetController = new EfficiencyTargetController();
