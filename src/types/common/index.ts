import type z from 'zod';
import { type PaginationRules } from '../../validations/common/index.js';

export type PaginationParams = z.infer<typeof PaginationRules>;
