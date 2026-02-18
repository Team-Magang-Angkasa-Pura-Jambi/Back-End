import type prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';

// Generated for Sentinel Project
export type EnergyPayload = Prisma.Args<typeof prisma.energyType, 'create'>['data'];
