import { type Prisma } from '@prisma/client';
import type prisma from '../../configs/db.js';

export type UserPayload = Prisma.Args<typeof prisma.user, 'create'>['data'];
export type UpadateUserPayload = Prisma.Args<typeof prisma.user, 'update'>['data'];
