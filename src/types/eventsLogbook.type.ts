import { z } from 'zod';
import type { logBookScheme } from '../validations/eventsLogbook.validation.js';

export type CreateLogbookBody = z.infer<typeof logBookScheme.body>;

export type UpdateLogbookBody = z.infer<typeof logBookScheme.bodyPartial>;

export type LogbookParams = z.infer<typeof logBookScheme.params>;

export type GetLogbookQuery = z.infer<typeof logBookScheme.listQuery>;
