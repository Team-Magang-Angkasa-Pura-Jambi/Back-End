import { z } from 'zod';
import type { efficiencyScheme } from '../validations/efficiencyTargets.validation.js';

export type CreateEfficiencyBody = z.infer<typeof efficiencyScheme.body>;

export type UpdateEfficiencyBody = z.infer<typeof efficiencyScheme.bodyPartial>;

export type EfficiencyParams = z.infer<typeof efficiencyScheme.params>;

export type GetEfficiencyQuery = z.infer<typeof efficiencyScheme.listQuery>;
