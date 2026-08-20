// Generated for Sentinel Project

import type prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';

export type NotificationsPayload = Prisma.Args<typeof prisma.notification, 'create'>['data'];
export type UpdateNotificationsPayload = Prisma.Args<typeof prisma.notification, 'update'>['data'];
