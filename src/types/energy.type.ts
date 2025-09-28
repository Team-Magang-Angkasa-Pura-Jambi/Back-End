import { z } from 'zod';
import type {
  energyTypeSchema,
  queryEnergy,
} from '../validations/energy.validation.js';
import type { getReadingsSchema } from '../validations/reading.validation.js';

export type CreateEnergyTypeBody = z.infer<typeof energyTypeSchema.body>;

export type UpdateEnergyTypeBody = z.infer<typeof energyTypeSchema.bodyPartial>;

export type EnergyTypeParams = z.infer<typeof energyTypeSchema.params>;

export type GetEnergyTypesQuery = z.infer<typeof queryEnergy>['query'];
