import { z } from 'zod';
import type {
  userQuerySchema,
  userSchemas,
} from '../../validations/auth/user.validation.js';

export type CreateUserBody = z.infer<typeof userSchemas.body>;

export type UpdateUserBody = z.infer<typeof userSchemas.bodyPartial>;

export type UserParams = z.infer<typeof userSchemas.params>;

export type GetUsersQuery = z.infer<typeof userQuerySchema>['query'];
