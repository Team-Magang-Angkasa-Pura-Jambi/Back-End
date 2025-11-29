import type z from 'zod';
import type { loginSchema } from '../validations/auth.validation.js';


export type LoginBody = z.infer<typeof loginSchema>['body'];
