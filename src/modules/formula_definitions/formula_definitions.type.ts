import { type Prisma } from '../../generated/prisma/index.js';

/**
 * Payload untuk Create Formula
 * Menggunakan Unchecked agar bisa langsung passing template_id (String/UUID)
 */
export interface CreateFormulaPayload {
  formula: Prisma.FormulaDefinitionUncheckedCreateInput;
}

/**
 * Payload untuk Update Formula
 */
export interface UpdateFormulaPayload {
  formula: Prisma.FormulaDefinitionUncheckedUpdateInput;
}

/**
 * Type untuk satu item dalam array formula_items (Helper untuk logic ke depan)
 */
export interface FormulaItem {
  type: 'field' | 'operator' | 'constant' | 'variable';
  value: string;
}
