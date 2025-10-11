import { z } from 'zod';
import type { DailyLogbook as DailyLogbookPrisma } from '../generated/prisma/index.js';
import {
  getLogbooksQuerySchema,
  logbookSchemas,
} from '../validations/dailyLogbook.validation.js';

export type GetLogbooksQuery = z.infer<typeof getLogbooksQuerySchema>['query'];
export type LogbookParams = z.infer<typeof logbookSchemas.params>;
export type CreateDailyLogbookBody = z.infer<typeof logbookSchemas.body>;
export type UpdateDailyLogbookBody = z.infer<typeof logbookSchemas.bodyPartial>;
export type DailyLogbook = DailyLogbookPrisma;
