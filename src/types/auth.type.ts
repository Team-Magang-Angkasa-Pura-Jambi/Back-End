import type z from 'zod';
import type { loginSchema } from '../validations/auth.validation.js';
import type { createUserSchema, updateUserSchema } from '../validations/user.validation.js';


export type LoginBody = z.infer<typeof loginSchema>['body'];
export type CreateUserBody = z.infer<typeof createUserSchema>['body'];

export type UpdateUserBody = z.infer<typeof updateUserSchema>['body'];
export type UpdateUserParams = z.infer<typeof updateUserSchema>['params'];


