import type z from 'zod';
import type { loginSchema } from '../validations/auth.validation.js';
import type {
  createUserSchema,
  updateUserSchema,
} from '../validations/user.validation.js';

export type LoginBody = z.infer<typeof loginSchema>['body'];
