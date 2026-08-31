import 'dotenv/config';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

async function test() {
  try {
    const { object } = await generateObject({
      model: google('gemini-3.6-flash'),
      prompt: 'Hitung selisih stand',
      schema: z.object({
        formula: z.string()
      }),
    });
    console.log("SUCCESS:", object);
  } catch (e) {
    console.error("ERROR:");
    console.error(e.message);
  }
}

test();
