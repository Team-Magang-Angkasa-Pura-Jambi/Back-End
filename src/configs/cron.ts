// import cron, { type ScheduledTask } from 'node-cron';
// import prisma from '../configs/db.js';
// import { logger } from '../configs/logger.js';

// // ─── Types ───────────────────────────────────────────────────
// interface CronJobDefinition {
//   name: string;
//   expression: string;
//   description: string;
//   enabled: boolean;
//   handler: () => Promise<void>;
// }

// interface CronJobStatus {
//   name: string;
//   description: string;
//   expression: string;
//   enabled: boolean;
//   lastRun: Date | null;
//   lastStatus: 'success' | 'failed' | 'running' | 'idle';
//   lastError: string | null;
//   runCount: number;
// }

// // ─── Runtime State ───────────────────────────────────────────
// const tasks: Map<string, ScheduledTask> = new Map();
// const jobStatuses: Map<string, CronJobStatus> = new Map();

// // ─── Job Wrapper (Sentry-style: catch, log, metrics) ─────────
// const withSafeExecution = (jobDef: CronJobDefinition) => {
//   return async () => {
//     const status = jobStatuses.get(jobDef.name);
//     if (!status) return;

//     if (status.lastStatus === 'running') {
//       logger.warn(`[Cron] ⏭️  Skipping "${jobDef.name}" — still running from previous tick.`);
//       return;
//     }

//     status.lastStatus = 'running';
//     status.lastRun = new Date();
//     const startMs = Date.now();

//     try {
//       await jobDef.handler();
//       const durationMs = Date.now() - startMs;
//       status.lastStatus = 'success';
//       status.lastError = null;
//       status.runCount++;
//       logger.info(`[Cron] ✅ "${jobDef.name}" completed in ${durationMs}ms (run #${status.runCount})`);
//     } catch (err: any) {
//       const durationMs = Date.now() - startMs;
//       status.lastStatus = 'failed';
//       status.lastError = err?.message || String(err);
//       status.runCount++;
//       logger.error(`[Cron] ❌ "${jobDef.name}" failed after ${durationMs}ms: ${status.lastError}`);
//     }
//   };
// };

// // ═══════════════════════════════════════════════════════════════
// // JOB DEFINITIONS
// // ═══════════════════════════════════════════════════════════════

// const jobs: CronJobDefinition[] = [
//   // ─── 1. Cleanup Expired Notifications (every day at 02:00) ───
//   {
//     name: 'cleanup-old-notifications',
//     expression: '0 2 * * *',
//     description: 'Menghapus notifikasi yang sudah dibaca dan berusia > 30 hari.',
//     enabled: true,
//     handler: async () => {
//       const thirtyDaysAgo = new Date();
//       thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

//       const result = await prisma.notification.deleteMany({
//         where: {
//           is_read: true,
//           created_at: { lt: thirtyDaysAgo },
//         },
//       });

//       logger.info(`[Cron:cleanup-old-notifications] Deleted ${result.count} old read notifications.`);
//     },
//   },

//   // ─── 2. Cleanup Old Audit Logs (monthly, 1st at 03:00) ──────
//   {
//     name: 'cleanup-old-audit-logs',
//     expression: '0 3 1 * *',
//     description: 'Menghapus audit log yang berusia > 6 bulan untuk efisiensi storage.',
//     enabled: true,
//     handler: async () => {
//       const sixMonthsAgo = new Date();
//       sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

//       const result = await prisma.auditLog.deleteMany({
//         where: {
//           created_at: { lt: sixMonthsAgo },
//         },
//       });

//       logger.info(`[Cron:cleanup-old-audit-logs] Purged ${result.count} audit logs older than 6 months.`);
//     },
//   },

//   // ─── 3. Auto-resolve Stale Bug Reports (weekly, Sunday 04:00) ─
//   {
//     name: 'auto-close-stale-bugs',
//     expression: '0 4 * * 0',
//     description: 'Menutup laporan bug berstatus RESOLVED yang sudah > 14 hari tanpa aktivitas.',
//     enabled: true,
//     handler: async () => {
//       const fourteenDaysAgo = new Date();
//       fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

//       const result = await prisma.bugReport.updateMany({
//         where: {
//           status: 'RESOLVED',
//           updated_at: { lt: fourteenDaysAgo },
//         },
//         data: {
//           developer_response: 'Auto-closed oleh sistem setelah 14 hari tanpa aktivitas.',
//         },
//       });

//       logger.info(`[Cron:auto-close-stale-bugs] Updated ${result.count} stale resolved bug reports.`);
//     },
//   },

//   // ─── 4. Database Health Ping (every 5 minutes) ──────────────
//   {
//     name: 'db-health-ping',
//     expression: '*/5 * * * *',
//     description: 'Ping koneksi database untuk deteksi dini connection pool issues.',
//     enabled: true,
//     handler: async () => {
//       const start = Date.now();
//       await prisma.$queryRaw`SELECT 1`;
//       const latency = Date.now() - start;

//       if (latency > 1000) {
//         logger.warn(`[Cron:db-health-ping] Database latency tinggi: ${latency}ms`);
//       }
//     },
//   },

//   // ─── 5. Daily Data Integrity Check (every day at 01:00) ─────
//   {
//     name: 'data-integrity-check',
//     expression: '0 1 * * *',
//     description: 'Cek meter tanpa daily_summary hari kemarin dan buat notifikasi admin.',
//     enabled: true,
//     handler: async () => {
//       const yesterday = new Date();
//       yesterday.setDate(yesterday.getDate() - 1);
//       yesterday.setHours(0, 0, 0, 0);

//       const endOfYesterday = new Date(yesterday);
//       endOfYesterday.setHours(23, 59, 59, 999);

//       // Get all active meters
//       const meters = await prisma.meter.findMany({
//         where: { is_active: true },
//         select: { meter_id: true, meter_code: true, name: true },
//       });

//       // Get meters that have summaries for yesterday
//       const summarized = await prisma.dailySummary.findMany({
//         where: {
//           summary_date: { gte: yesterday, lte: endOfYesterday },
//         },
//         select: { meter_id: true },
//       });

//       const summarizedIds = new Set(summarized.map((s) => s.meter_id));
//       const missing = meters.filter((m) => !summarizedIds.has(m.meter_id));

//       if (missing.length > 0) {
//         logger.warn(
//           `[Cron:data-integrity-check] ${missing.length} meter belum ada data kemarin: ${missing.map((m) => m.meter_code).join(', ')}`,
//         );

//         // Notify all SUPER_ADMIN users
//         const admins = await prisma.user.findMany({
//           where: { role: { role_name: 'SUPER_ADMIN' } },
//           select: { user_id: true },
//         });

//         if (admins.length > 0) {
//           await prisma.notification.createMany({
//             data: admins.map((admin) => ({
//               user_id: admin.user_id,
//               title: `⚠️ ${missing.length} meter belum terisi data`,
//               message: `Data pembacaan tanggal ${yesterday.toLocaleDateString('id-ID')} belum diinput untuk: ${missing
//                 .slice(0, 5)
//                 .map((m) => m.meter_code)
//                 .join(', ')}${missing.length > 5 ? ` dan ${missing.length - 5} lainnya` : ''}`,
//               type: 'WARNING',
//             })),
//           });
//         }
//       } else {
//         logger.info('[Cron:data-integrity-check] Semua meter sudah memiliki data kemarin. ✅');
//       }
//     },
//   },
// ];

// // ═══════════════════════════════════════════════════════════════
// // SCHEDULER ENGINE
// // ═══════════════════════════════════════════════════════════════

// export const cronService = {
//   /**
//    * Initialize all cron jobs. Called once at server startup.
//    */
//   start: () => {
//     logger.info(`[Cron] 🔧 Registering ${jobs.length} cron jobs...`);

//     for (const jobDef of jobs) {
//       if (!cron.validate(jobDef.expression)) {
//         logger.error(`[Cron] ❌ Invalid expression for "${jobDef.name}": ${jobDef.expression}`);
//         continue;
//       }

//       // Initialize status tracker
//       jobStatuses.set(jobDef.name, {
//         name: jobDef.name,
//         description: jobDef.description,
//         expression: jobDef.expression,
//         enabled: jobDef.enabled,
//         lastRun: null,
//         lastStatus: 'idle',
//         lastError: null,
//         runCount: 0,
//       });

//       if (!jobDef.enabled) {
//         logger.info(`[Cron] ⏸️  "${jobDef.name}" — DISABLED, skipping.`);
//         continue;
//       }

//       const task = cron.schedule(jobDef.expression, withSafeExecution(jobDef), {
//         scheduled: true,
//         timezone: 'Asia/Jakarta',
//       });

//       tasks.set(jobDef.name, task);
//       logger.info(`[Cron] ✅ "${jobDef.name}" registered → ${jobDef.expression} (${jobDef.description})`);
//     }

//     logger.info(`[Cron] 🚀 ${tasks.size}/${jobs.length} cron jobs active.`);
//   },

//   /**
//    * Gracefully stop all running cron tasks. Called on server shutdown.
//    */
//   stop: () => {
//     logger.info(`[Cron] 🛑 Stopping ${tasks.size} cron tasks...`);
//     for (const [name, task] of tasks) {
//       task.stop();
//       logger.info(`[Cron] ⏹️  Stopped "${name}".`);
//     }
//     tasks.clear();
//   },

//   /**
//    * Get the status of all registered cron jobs (for monitoring API).
//    */
//   getStatus: (): CronJobStatus[] => {
//     return Array.from(jobStatuses.values());
//   },

//   /**
//    * Manually trigger a specific job by name (for admin/debug).
//    */
//   triggerJob: async (name: string): Promise<{ success: boolean; message: string }> => {
//     const jobDef = jobs.find((j) => j.name === name);
//     if (!jobDef) {
//       return { success: false, message: `Job "${name}" not found.` };
//     }

//     logger.info(`[Cron] 🔄 Manual trigger: "${name}"`);
//     await withSafeExecution(jobDef)();

//     const status = jobStatuses.get(name);
//     return {
//       success: status?.lastStatus === 'success',
//       message: status?.lastError || 'Job executed successfully.',
//     };
//   },
// };
