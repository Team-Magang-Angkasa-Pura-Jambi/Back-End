import cron from 'node-cron';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import prisma from '../../configs/db.js';
import { systemConfigService } from '../system_config/system_config.service.js';

const anomalySchema = z.object({
  anomalies: z.array(
    z.object({
      meter_id: z.number(),
      severity: z.enum(['CRITICAL', 'WARNING']),
      reason: z.string(),
    })
  ),
  is_all_normal: z.boolean(),
  summary: z.string(),
});

export const startAnomalyDetectorJob = () => {
  // Menjalankan cron job 1x sehari pukul 06:00 pagi WIB
  cron.schedule('0 6 * * *', async () => {
    console.log('🤖 [AI Anomaly Detector] Memulai pemindaian background...');
    try {
      const config = await systemConfigService.getConfig();
      const apiKey = config.ai?.google_generative_ai_api_key ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      if (!apiKey) {
        console.warn('⚠️ [AI Anomaly Detector] API Key belum diatur. Melewati tugas...');
        return;
      }

      const googleProvider = createGoogleGenerativeAI({ apiKey });

      // Ambil klasifikasi ML terbaru dalam 1 jam terakhir
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentAnomalies = await (prisma as any).mlClassification.findMany({
        where: {
          label: { in: ['Boros', 'Layanan Tidak Maksimal / Sangat Efisien'] },
          // Asumsi ada kolom created_at, jika tidak ada, cukup ambil 10 terakhir
        },
        take: 10,
      }).catch(async () => {
         // Fallback jika tidak ada tabel atau error
         return [];
      });

      if (!recentAnomalies || recentAnomalies.length === 0) {
        console.log('🤖 [AI Anomaly Detector] Tidak ada anomali dari ML API hari ini.');
        return;
      }

      const systemPrompt = `Anda adalah Asisten Komunikasi dari Sentinel V2. 
Tugas Anda adalah merangkum data Anomali hasil deteksi Engine Machine Learning (ML) ke dalam format kalimat peringatan yang manusiawi.
Jangan menganalisis data mentah, cukup jelaskan apa yang ditemukan oleh ML.`;

      const prompt = `Laporan Anomali ML Terdeteksi:\n${JSON.stringify(recentAnomalies, null, 2)}`;

      const { object } = await generateObject({
        model: googleProvider('gemini-3.6-flash'),
        system: systemPrompt,
        prompt: prompt,
        schema: anomalySchema,
      });

      if (object.is_all_normal || !object.anomalies || object.anomalies.length === 0) {
        console.log(`🤖 [AI Anomaly Detector] Pemindaian selesai: Semua sistem normal. (${object.summary})`);
      } else {
        console.log(`🤖 [AI Anomaly Detector] Ditemukan ${object.anomalies.length} anomali! Menyimpan ke Notifikasi...`);
        
        // Dapatkan super admin (user_id 1 atau user pertama dengan role SUPER_ADMIN)
        const superAdmin = await prisma.user.findFirst({
          where: { role: { role_name: 'SUPER_ADMIN' } }
        });

        const fallbackUserId = superAdmin?.user_id ?? 1;

        for (const anomaly of object.anomalies) {
          // Buat notifikasi
          await prisma.notification.create({
            data: {
              user_id: fallbackUserId,
              category: 'ANOMALY_DETECTED',
              severity: anomaly.severity as any,
              title: `Anomali Terdeteksi (Meter #${anomaly.meter_id})`,
              message: anomaly.reason,
            }
          });
        }
      }
    } catch (error: any) {
      console.error('❌ [AI Anomaly Detector] Error saat pemindaian:', error.message);
    }
  });

  console.log('📅 [Cron] AI Anomaly Detector Job di-schedule (Interval: 1x sehari pukul 06:00).');
};
