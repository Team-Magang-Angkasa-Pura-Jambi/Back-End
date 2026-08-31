import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import prisma from '../../configs/db.js';
import { systemConfigService } from '../system_config/system_config.service.js';
import { Error500 } from '../../utils/customError.js';

const formulaVariableSchema = z.object({
  label: z.string().describe('Label variabel (uppercase, e.g. STAND_NOW, TINGGI_BBM)'),
  type: z.enum(['reading', 'spec', 'constant']).describe('Kategori variabel'),
  readingTypeId: z
    .number()
    .optional()
    .describe(
      "Wajib jika type='reading'. Contoh: 1 untuk Stand Meter/Listrik, 2 untuk Tinggi BBM.",
    ),
  timeShift: z
    .number()
    .optional()
    .describe("Wajib jika type='reading'. 0 untuk hari ini (H-0), -1 untuk kemarin (H-1)"),
  specField: z
    .string()
    .optional()
    .describe(
      "Wajib jika type='spec'. Contoh: 'multiplier', 'capacity_liters', 'diameter_cm', 'length_cm', 'width_cm', 'height_max_cm', 'rollover_limit'",
    ),
  value: z
    .number()
    .optional()
    .describe("Wajib jika type='constant'. Nilai statis (misal: 3.14159)"),
});

const formulaDefinitionSchema = z.object({
  name: z.string().describe('Nama singkat sub-kalkulasi ini'),
  is_main: z.boolean().describe('Apakah ini perhitungan utama (biasanya true)'),
  formula_items: z.object({
    formula: z
      .string()
      .describe(
        'Ekspresi matematika menggunakan label variabel. Gunakan +, -, *, /, ^ (pangkat). Konstanta Math diperbolehkan seperti PI. Contoh: (STAND_NOW - STAND_PREV) * MULTIPLIER',
      ),
    variables: z
      .array(formulaVariableSchema)
      .describe('Daftar variabel yang dirujuk dalam formula'),
  }),
});

const aiResponseSchema = z.object({
  definitions: z.array(formulaDefinitionSchema).describe('Daftar sub-rumus (biasanya hanya 1)'),
});

export const generateFormulaService = async (prompt: string, userId?: number) => {
  const systemPrompt = `
Anda adalah AI Copilot untuk sistem Sentinel V2 (Operational Intelligence Bandara). 
Tugas Anda adalah merancang rumus kalkulasi matematika untuk konsumsi meteran (Listrik, Air, BBM) atau profil tangki berdasarkan instruksi natural language dari pengguna.

Aturan Pembuatan Variabel:
- 'reading': Data dinamis harian. Parameter yang umum: ID 1 = Meter Stand/Listrik/Air/Tinggi BBM. timeShift: 0 = Hari ini, -1 = Kemarin.
- 'spec': Data statis meter/tangki. Field yang didukung: multiplier, capacity_liters, diameter_cm, length_cm, width_cm, height_max_cm, rollover_limit.
- 'constant': Angka tetap (e.g. 3.14159265 untuk PI).

Penting: 
- Label variabel bebas, tetapi usahakan deskriptif (STAND_NOW, STAND_PREV, MULTIPLIER, TINGGI_BBM, TINGGI_PREV, CAPACITY).
- Rumus JavaScript-like matematis murni.

Contoh 1: "Selisih stand dikali multiplier" (Untuk Meteran Pasca-Bayar/Biasa)
Formula: (STAND_NOW - STAND_PREV) * MULTIPLIER
Variabel: STAND_NOW (reading, id 1, ts 0), STAND_PREV (reading, id 1, ts -1), MULTIPLIER (spec, 'multiplier')

Contoh 2: "Penggunaan listrik token" (Meteran Pra-Bayar/Token, stand menurun)
Formula: (STAND_PREV - STAND_NOW) * MULTIPLIER
Variabel: STAND_PREV (reading, id 1, ts -1), STAND_NOW (reading, id 1, ts 0), MULTIPLIER (spec, 'multiplier')

Contoh 3: "Volume tangki kotak"
Formula: (PANJANG * LEBAR * TINGGI_BBM) / 1000
Variabel: PANJANG (spec 'length_cm'), LEBAR (spec 'width_cm'), TINGGI_BBM (reading id 1 ts 0)
`;

  const config = await systemConfigService.getConfig();
  const apiKey =
    config.ai?.google_generative_ai_api_key ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  const googleProvider = createGoogleGenerativeAI({
    apiKey: apiKey,
  });

  let result;
  const startTime = performance.now();

  try {
    result = await generateObject({
      model: googleProvider('gemini-3.6-flash'),
      system: systemPrompt,
      prompt: prompt,
      schema: z.object({
        definitions: z.array(formulaDefinitionSchema),
      }),
    });
  } catch (apiError: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ [MOCK MODE] Gagal memanggil AI untuk Formula. Merender balasan lokal.');
      result = {
        object: {
          definitions: [
            {
              name: 'MOCK Formula (Token Habis)',
              is_main: true,
              formula_items: {
                formula: '(STAND_NOW - STAND_PREV) * 1',
                variables: [
                  { type: 'reading', label: 'STAND_NOW', timeShift: 0, readingTypeId: 1 },
                  { type: 'reading', label: 'STAND_PREV', timeShift: -1, readingTypeId: 1 },
                ],
              },
            },
          ],
        },
      };
    } else {
      throw apiError;
    }
  }

  try {
    const latency = Math.round(performance.now() - startTime);
    await prisma.aiAgentLog
      .create({
        data: {
          user_id: userId,
          prompt: prompt,
          response_json: result.object as any,
          latency_ms: latency,
          model_used: 'gemini-3.6-flash',
          is_success: true,
        },
      })
      .catch((e) => console.error('Failed to save AI Log', e));

    return result.object;
  } catch (err: any) {
    const latency = Math.round(performance.now() - startTime);
    await prisma.aiAgentLog
      .create({
        data: {
          user_id: userId,
          prompt: prompt,
          error_message: err.message ?? 'Unknown error',
          latency_ms: latency,
          model_used: 'gemini-3.6-flash',
          is_success: false,
        },
      })
      .catch((e) => console.error('Failed to save AI Error Log', e));

    throw new Error500(err.message ?? 'Error saat komunikasi dengan Google AI');
  }
};

export const getAiLogsService = async (page = 1, limit = 50) => {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    prisma.aiAgentLog.findMany({
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: { full_name: true, username: true },
        },
      },
    }),
    prisma.aiAgentLog.count(),
  ]);

  return { data, total, page, limit };
};
