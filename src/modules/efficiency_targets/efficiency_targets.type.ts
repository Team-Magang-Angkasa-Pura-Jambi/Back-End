// Generated for Sentinel Project

import type prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';

export type EfficiencyTargetPayload = Prisma.Args<typeof prisma.efficiencyTarget, 'create'>['data'];
export type UploadEfficiencyTargetPayload = Prisma.Args<
  typeof prisma.efficiencyTarget,
  'update'
>['data'];
