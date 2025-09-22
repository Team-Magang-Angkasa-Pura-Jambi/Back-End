// src/controllers/efficiencyTarget.controller.ts

import { BaseController } from '../utils/baseController.js';
import { EfficiencyTargetService } from '../services/efficiencyTarget.service.js';
import { res201 } from '../utils/response.js';

import type { EfficiencyTarget } from '../generated/prisma/index.js';
import type { Request, Response, NextFunction } from 'express';
import type {
  EfficiencyTargetCreateInput,
  EfficiencyTargetUpdateInput,
} from '../types/efficiencyTarget.type.js';

// Definisikan tipe-tipe spesifik
type EfficiencyTargetModel = EfficiencyTarget;

export class EfficiencyTargetController extends BaseController<
  EfficiencyTargetModel,
  EfficiencyTargetCreateInput,
  EfficiencyTargetUpdateInput,
  EfficiencyTargetService // Berikan service yang sesuai
> {
  constructor(efficiencyTargetService: EfficiencyTargetService) {
    // Kirim service dan nama parameter ID rute ke parent controller
    super(efficiencyTargetService, 'target_id');
  }

  /**
   * Override metode create untuk menangani logika spesifik,
   * yaitu mengambil userId dari data otentikasi.
   */
  public override create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const body: EfficiencyTargetCreateInput = res.locals.validatedData.body;

    // Asumsi: userId didapat dari middleware otentikasi
    const userId = res.locals.user.id;

    // Panggil metode create SPESIFIK dari EfficiencyTargetService
    const result = await this.service.create(userId, { data: body });

    res201({ res, message: 'Berhasil membuat target baru.', data: result });
  };
}
