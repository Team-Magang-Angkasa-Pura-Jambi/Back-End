import { z } from 'zod';


export const loginSchema = z.object({
  body: z.object({
    username: z.string({ error: 'Username is required' }),
    password: z.string({ error: 'Password is required' }),
  }),
});
