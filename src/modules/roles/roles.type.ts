// Generated for Sentinel Project

import { type Prisma } from '@prisma/client';
import type prisma from '../../configs/db.js';

export type RolesPayload = Prisma.Args<typeof prisma.role, 'create'>['data'];
