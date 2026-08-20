import { type z } from 'zod';
import {
  type generateLogbookSchema,
  type getLogbookByIdSchema,
  type getLogbooksSchema,
  type updateLogbookSchema,
} from '../../validations/operations/dailyLogbook.validation.js';

// DailyLogbook is not in the current Prisma schema — using a local interface
export interface DailyLogbook {
  logbook_id: number;
  meter_id: number;
  date: Date;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

export type GetLogbooksQuery = z.infer<typeof getLogbooksSchema>['query'];
export type LogbookParams = z.infer<typeof getLogbookByIdSchema>['params'];
export type CreateDailyLogbookBody = z.infer<typeof generateLogbookSchema>['body'];
export type UpdateDailyLogbookBody = z.infer<typeof updateLogbookSchema>['body'];
