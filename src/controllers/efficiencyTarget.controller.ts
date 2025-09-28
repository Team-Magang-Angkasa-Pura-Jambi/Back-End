// src/controllers/efficiencyTarget.controller.ts

import { BaseController } from '../utils/baseController.js';
import { EfficiencyTargetService } from '../services/efficiencyTarget.service.js';
import type { EfficiencyTarget } from '../generated/prisma/index.js';
import type {
  CreateEfficiencyBody,
  GetEfficiencyQuery,
  UpdateEfficiencyBody,
} from '../types/efficiencyTarget.type.js';
import type { Request, Response } from 'express';
import { res200 } from '../utils/response.js';

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
  public override create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user?.id;

    const dataWithUser = {
      ...req.body,
      set_by_user_id: userId, // Pastikan nama field ini cocok dengan skema Zod/Prisma Anda
    };

    const newRecord = await this.service.create(dataWithUser);

    res200({ res, message: 'success', data: newRecord });
  };
}
