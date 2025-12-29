import { z } from 'zod';
import type { paxScheme } from '../../validations/operations/paxData.validation.js';

export type CreatePaxParamsBody = z.infer<typeof paxScheme.body>;

export type UpdatePaxParamsBody = z.infer<typeof paxScheme.bodyPartial>;

export type ParamsPaxParams = z.infer<typeof paxScheme.params>;

export type GetPaxParamsQuery = z.infer<typeof paxScheme.listQuery>;
