import { type Prisma } from '../../generated/prisma/index.js';

/**
 * Payload untuk Create
 * Menggunakan UncheckedCreateInput agar bisa menyertakan relasi definitions
 */
export interface CreateTemplatePayload {
  template: Prisma.CalculationTemplateCreateInput;
}

/**
 * Payload untuk Update
 * Kita gunakan Partial agar field yang dikirim bisa opsional
 */
export interface UpdateTemplatePayload {
  template: Prisma.CalculationTemplateUpdateInput;
}

/**
 * Type khusus untuk Formula Definition jika ingin diakses terpisah
 */
export type FormulaDefinitionInput = Prisma.FormulaDefinitionCreateWithoutTemplateInput;
