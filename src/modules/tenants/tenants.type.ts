// Generated for Sentinel Project

import type prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';

export type PayloadTenants = Prisma.Args<typeof prisma.tenant, 'create'>['data'];
export type UpdatePayloadTenants = Prisma.Args<typeof prisma.tenant, 'update'>['data'];
