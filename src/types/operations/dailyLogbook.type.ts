import { z } from 'zod';
import type { DailyLogbook as DailyLogbookPrisma } from '../../generated/prisma/index.js';
import {
  generateLogbookSchema,
  getLogbookByIdSchema,
  getLogbooksSchema,
  updateLogbookSchema,
} from '../../validations/operations/dailyLogbook.validation.js';

export type GetLogbooksQuery = z.infer<typeof getLogbooksSchema>['query'];
export type LogbookParams = z.infer<typeof getLogbookByIdSchema>['params'];
export type CreateDailyLogbookBody = z.infer<
  typeof generateLogbookSchema
>['body'];
export type UpdateDailyLogbookBody = z.infer<
  typeof updateLogbookSchema
>['body'];
export type DailyLogbook = DailyLogbookPrisma;
