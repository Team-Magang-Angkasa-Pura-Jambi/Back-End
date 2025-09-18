import type z from 'zod';
import type {
  createRoleSchema,
  updateRoleSchema,
} from '../validations/role.validation.js';

// Mengekstrak tipe dari skema Zod untuk body request
export type CreateRoleInput = z.infer<typeof createRoleSchema>['body'];
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>['body'];
