import { type z } from 'zod';
import { type getAnalysisSchema } from '../../validations/reports/analysis.validation.js';

// UsageCategory is not in the Prisma schema — defined locally
export type UsageCategory = 'SANGAT_EFISIEN' | 'NORMAL' | 'MENDEKATI_LIMIT' | 'OVER_BUDGET' | 'UNKNOWN';

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
