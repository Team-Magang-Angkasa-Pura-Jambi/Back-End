import { type z } from 'zod';
import type { summaryDetailScheme } from '../../validations/reports/summaryDetail.validation.js';

export type CreateSummaryDetailBody = z.infer<typeof summaryDetailScheme.body>;

export type UpdateSummaryDetailBody = z.infer<typeof summaryDetailScheme.bodyPartial>;

export type SummaryDetailParams = z.infer<typeof summaryDetailScheme.params>;

export type GetSummaryDetailQuery = z.infer<typeof summaryDetailScheme.listQuery>;
