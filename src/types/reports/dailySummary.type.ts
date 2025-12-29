import { z } from 'zod';

import type { summaryScheme } from '../validations/dailySummary.validation.js';

export type CreateSummaryBody = z.infer<typeof summaryScheme.body>;

export type UpdateSummaryBody = z.infer<typeof summaryScheme.bodyPartial>;

export type SummaryParams = z.infer<typeof summaryScheme.params>;

export type GetSummaryQuery = z.infer<typeof summaryScheme.listQuery>;
