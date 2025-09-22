import prisma from '../configs/db.js';
import type { EfficiencyTarget } from '../generated/prisma/index.js';
import { Error404 } from '../utils/customError.js';
import { GenericBaseService } from '../utils/GenericBaseService.js';
import type { CustomErrorMessages } from '../utils/baseService.js';

import type {
  EfficiencyTargetCreateInput,
  EfficiencyTargetUpdateInput,
} from '../types/efficiencyTarget.type.js';

type EfficiencyTargetModel = EfficiencyTarget;

export class EfficiencyTargetService extends GenericBaseService<
  EfficiencyTargetModel,
  EfficiencyTargetCreateInput,
  EfficiencyTargetUpdateInput
> {
  constructor() {
    super(prisma, prisma.efficiencyTarget, 'target_id');
  }

  /**
   * Override metode 'create' untuk menambahkan validasi dan logika bisnis.
   */
}
