import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  ML_API_BASE_URL: z.string().url().default('http://localhost:8000'),
  OPENWEATHER_API_KEY: z.string().optional(),
  OPENWEATHER_LATITUDE: z.coerce.number().optional().default(-1.63806),
  OPENWEATHER_LONGITUDE: z.coerce.number().optional().default(103.6444),
  OPENWEATHER_BASE_URL: z
    .string()
    .url()
    .optional()
    .default('https://api.openweathermap.org/data/2.5/forecast'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid Environment Variables Configuration:');
  console.error(parsedEnv.error.format());
  // In development, log errors clearly but let app proceed with defaults where possible
}

export const env = parsedEnv.success ? parsedEnv.data : (process.env as any);
export default env;
