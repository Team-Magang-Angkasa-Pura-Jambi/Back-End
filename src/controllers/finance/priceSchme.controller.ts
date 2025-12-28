// src/controllers/priceScheme.controller.ts

import type { Request, Response } from 'express';
import type { PriceScheme } from '../../generated/prisma/index.js';
import {
  priceSchemeService,
  PriceSchemeService,
} from '../../services/finance/priceShcema.service.js';
import type {
  CreatePriceSchemaBody,
  GetPriceSchemasQuery,
  UpdatePriceSchemaBody,
} from '../../types/finance/priceSchema.types.js';
// 1. Perbaiki typo pada nama file service
import { BaseController } from '../../utils/baseController.js';
import { res200 } from '../../utils/response.js';

export class PriceSchemeController extends BaseController<
  PriceScheme,
  CreatePriceSchemaBody,
  UpdatePriceSchemaBody,
  GetPriceSchemasQuery,
  PriceSchemeService
> {
  constructor() {
    super(priceSchemeService, 'schemeId');
  }

  public override create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    console.log(`Mencoba membuat Price Scheme baru...`);

    const userId = req.user?.id;

    const internalData = {
      ...req.body,
      set_by_user_id: userId,
    };

    const newRecord = await this.service.create(internalData);

    res200({
      res,
      message: 'Price Scheme berhasil dibuat.',
      data: newRecord,
    });
  };
}
