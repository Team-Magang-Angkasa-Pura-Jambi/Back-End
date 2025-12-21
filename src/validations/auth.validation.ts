import { z } from 'zod';
import { requiredString } from '../utils/schmeHelper.js';

export const loginSchema = z.object({
  body: z.object({
    username: requiredString('username'),
    password: requiredString('password'),
  }),
});
