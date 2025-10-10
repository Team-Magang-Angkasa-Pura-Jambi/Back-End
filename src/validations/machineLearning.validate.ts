import z from 'zod';

export const predictionSchema = z.object({
  body: z.object({
    tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'Format tanggal harus YYYY-MM-DD',
    }),
  }),
});
