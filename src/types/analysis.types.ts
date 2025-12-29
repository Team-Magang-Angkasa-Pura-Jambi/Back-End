import { z } from 'zod';
import { getAnalysisSchema } from '../validations/reports/analysis.validation.js';
import { UsageCategory } from '../generated/prisma/index.js';

export type GetAnalysisQuery = z.infer<typeof getAnalysisSchema>['query'];

export interface DailyAnalysisRecord {
  date: Date;
  actual_consumption: number | null;
  efficiency_target: number | null;
  prediction: number | null;
  consumption_cost: number | null;
  classification: UsageCategory | null;
  confidence_score: number | null;
  efficiency_target_cost: number | null;
}
