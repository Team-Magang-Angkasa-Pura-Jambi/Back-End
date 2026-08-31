import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { systemConfigService } from '../system_config/system_config.service.js';
import { Error500 } from '../../utils/customError.js';
import prisma from '../../configs/db.js';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const chatService = async (messages: Message[], userId?: number, sessionId?: string) => {
  const systemPrompt = `
Anda adalah Sentinel AI, asisten virtual cerdas untuk aplikasi operasional intelijen (Sentinel V2).
Tugas Anda adalah membantu pengguna (seperti admin atau teknisi) dalam memantau, merangkum, atau memandu operasional manajemen energi (Listrik, Air, BBM).

Aturan dasar:
- Jawab secara ringkas, jelas, dan profesional (gunakan bahasa Indonesia).
- Jika ada informasi yang belum jelas (misal lokasi atau tanggal), ajukan pertanyaan balik kepada user.
- Anda memiliki akses ke data operasional melalui sistem (jika diizinkan nanti). Untuk saat ini, layani percakapan sebaik mungkin.
`;

  const config = await systemConfigService.getConfig();
  const apiKey =
    config.ai?.google_generative_ai_api_key ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error500('API Key Google Gemini belum diatur.');
  }

  const googleProvider = createGoogleGenerativeAI({
    apiKey: apiKey,
  });

  const lastUserPrompt = messages.filter((m) => m.role === 'user').pop()?.content ?? '';

  // [GLOBAL SMART CACHING] Cek di SELURUH riwayat jika ada prompt yang persis sama
  if (lastUserPrompt) {
    const globalCachedLog = await prisma.aiAgentLog.findFirst({
      where: {
        prompt: lastUserPrompt,
        is_success: true,
      },
      orderBy: { created_at: 'desc' },
    });

    if (globalCachedLog?.response_json) {
      console.log(`[GLOBAL CACHE HIT] Menemukan respons cache untuk prompt: "${lastUserPrompt}"`);
      const responseText = (globalCachedLog.response_json as any).response;

      // Jika session berjalan, tetap update log session ini agar UI riwayat sinkron
      if (sessionId) {
        const fullTranscript =
          messages.map((m) => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n') +
          `\n\n[ASSISTANT]: ${responseText}`;
        const existing = await prisma.aiAgentLog.findFirst({ where: { session_id: sessionId } });
        if (existing) {
          await prisma.aiAgentLog.update({
            where: { log_id: existing.log_id },
            data: {
              prompt: lastUserPrompt,
              response_json: {
                type: 'chat',
                response: responseText,
                history: [...messages, { role: 'assistant', content: responseText }],
                cached: true,
              },
            },
          });
        }
      }
      return { text: responseText, cached: true };
    }
  }

  let result;
  const startTime = performance.now();

  try {
    result = await generateText({
      model: googleProvider('gemini-3.6-flash'),
      system: systemPrompt,
      messages: messages as any,
    });
  } catch (apiError: any) {
    // FALLBACK LOKAL UNTUK DEVELOPMENT SAAT TOKEN HABIS / ERROR
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '⚠️ [MOCK MODE] Gagal memanggil AI (Mungkin token habis). Merender balasan lokal.',
      );
      result = {
        text: '*(Balasan Offline)*: Maaf, kuota token AI (Google Gemini) sepertinya sedang habis atau terjadi gangguan jaringan. Silakan periksa kembali konfigurasi API Key atau isi ulang kuota Anda.',
      };
    } else {
      throw apiError;
    }
  }

  try {
    const latency = Math.round(performance.now() - startTime);
    const fullTranscript =
      messages.map((m) => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n') +
      `\n\n[ASSISTANT]: ${result.text}`;

    if (sessionId) {
      const existing = await prisma.aiAgentLog.findFirst({ where: { session_id: sessionId } });
      if (existing) {
        await prisma.aiAgentLog
          .update({
            where: { log_id: existing.log_id },
            data: {
              prompt: lastUserPrompt, // Simpan prompt terakhir agar Global Cache bekerja
              response_json: {
                type: 'chat',
                response: result.text,
                history: [...messages, { role: 'assistant', content: result.text }],
                cached: false,
                full_transcript: fullTranscript,
              },
              latency_ms: latency,
            },
          })
          .catch((e) => console.error('Failed to update log', e));
        return { text: result.text };
      }
    }

    await prisma.aiAgentLog
      .create({
        data: {
          user_id: userId,
          session_id: sessionId,
          prompt: lastUserPrompt,
          response_json: {
            type: 'chat',
            response: result.text,
            history: [...messages, { role: 'assistant', content: result.text }],
            cached: false,
            full_transcript: fullTranscript,
          },
          latency_ms: latency,
          model_used: 'gemini-3.6-flash',
          is_success: true,
        },
      })
      .catch((e) => console.error('Failed to log chat', e));

    return { text: result.text };
  } catch (err: any) {
    throw new Error500(err.message ?? 'Terjadi kesalahan saat memproses percakapan AI.');
  }
};
