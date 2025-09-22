// src/controllers/priceScheme.controller.ts

import type { PriceScheme, Prisma } from '../generated/prisma/index.js';
import type { PriceSchemeService } from '../services/priceShcema.service.js';
// 1. Perbaiki typo pada nama file service
import { BaseController } from '../utils/baseController.js';

// Definisikan tipe-tipe spesifik
type PriceSchemeModel = PriceScheme;
type PriceSchemeCreateInput = Prisma.PriceSchemeCreateInput;
// 2. Sesuaikan tipe UpdateInput agar cocok dengan constraint di BaseService
type PriceSchemeUpdateInput = Prisma.PriceSchemeUpdateInput &
  Record<string, any>;

export class PriceSchemeController extends BaseController<
  PriceSchemeModel,
  PriceSchemeCreateInput,
  PriceSchemeUpdateInput,
  PriceSchemeService
> {
  constructor(priceSchemeService: PriceSchemeService) {
    super(priceSchemeService, 'scheme_id');
  }
}
