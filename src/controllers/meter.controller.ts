import type {
  CreateMeterBody,
  GetMetersQuery,
  UpdateMeterBody,
} from '../types/meter.tpye.js';

import { BaseController } from '../utils/baseController.js';
import { MeterService } from '../services/meter.service.js';
import type { Meter } from '../generated/prisma/index.js';

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
}
