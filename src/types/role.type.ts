import type z from 'zod';
import type { roleSchemas } from '../validations/role.validation.js';

// Mengekstrak tipe dari skema Zod untuk body request
export type CreateRoleBody = z.infer<typeof roleSchemas.create>['body'];
export type UpdateRoleBody = z.infer<typeof roleSchemas.update>['body'];
export type GetRolesQuery = z.infer<typeof roleSchemas.listQuery>;
export type UserParams = z.infer<typeof roleSchemas.params>;
