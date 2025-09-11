import type z from 'zod';
import type {
  createUserSchema,
  loginSchema,
  updateUserSchema,
} from '../validations/auth.validation.js';

export type LoginBody = z.infer<typeof loginSchema>['body'];
export type CreateUserBody = z.infer<typeof createUserSchema>['body'];

export type UpdateUserBody = z.infer<typeof updateUserSchema>['body'];
export type UpdateUserParams = z.infer<typeof updateUserSchema>['params'];
