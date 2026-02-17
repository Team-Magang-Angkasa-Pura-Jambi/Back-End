// Generated for Sentinel Project
import z from 'zod';

export const authSchema = {
  login: z.object({
    body: z
      .object({
        username: z.string({ error: 'Username wajib diisi' }).min(1),
        password: z.string({ error: 'Password wajib diisi' }).min(1),
      })
      .strict(),
  }),
};
export type LoginPayload = z.infer<typeof authSchema.login>['body'];
