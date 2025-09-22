// src/types/efficiencyTarget.type.ts

import type { EfficiencyTarget } from '../generated/prisma/index.js';
import type { CrudTypes } from '../utils/generic.type.js';
import type {
  createEfficiencyTargetSchema,
  efficiencyTargetParamsSchema,
  updateEfficiencyTargetSchema,
} from '../validations/efficiencyTargets.validation.js';

/**
 * Tipe dasar untuk model EfficiencyTarget dari Prisma.
 */
export type EfficiencyTargetModel = EfficiencyTarget;

/**
 * [LANGKAH 1] Gunakan pabrik 'CrudTypes' untuk menghasilkan semua tipe input sekaligus.
 */
type EfficiencyTargetCrudTypes = CrudTypes<
  typeof createEfficiencyTargetSchema,
  typeof updateEfficiencyTargetSchema,
  typeof efficiencyTargetParamsSchema
>;

/**
 * [LANGKAH 2] Ekspor tipe-tipe individual dari hasil pabrik.
 */
export type EfficiencyTargetCreateInput =
  EfficiencyTargetCrudTypes['CreateInput'];
export type EfficiencyTargetUpdateInput =
  EfficiencyTargetCrudTypes['UpdateInput'];
export type EfficiencyTargetParams = EfficiencyTargetCrudTypes['Params'];
