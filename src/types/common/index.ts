import z from 'zod';
import { PaginationRules } from '../../validations/common/index.js';

export type PaginationParams = z.infer<typeof PaginationRules>;
