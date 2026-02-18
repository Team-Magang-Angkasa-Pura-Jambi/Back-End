import type prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';

// Generated for Sentinel
export type LocationsPayload = Prisma.Args<typeof prisma.location, 'create'>['data'];
export type UpdateLocationsPayload = Prisma.Args<typeof prisma.location, 'update'>['data'];
