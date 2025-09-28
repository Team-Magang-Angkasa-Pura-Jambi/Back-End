import { z } from 'zod';
import { getAnalysisSchema } from '../validations/analysis.validation.js';

export type GetAnalysisQuery = z.infer<typeof getAnalysisSchema>['query'];

export interface DailyAnalysisRecord {
  date: Date;
  actual_consumption: number | null;
  efficiency_target: number | null;
  prediction: number | null;
}
