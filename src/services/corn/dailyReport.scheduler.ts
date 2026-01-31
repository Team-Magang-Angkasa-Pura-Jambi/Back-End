import { schedule } from 'node-cron';
import prisma from '../../configs/db.js';
import { alertService } from '../notifications/alert.service.js';

const formatDate = (date: Date) =>
  date.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

export function startDailyReportScheduler() {
  console.log('⏰ Cron job untuk Laporan Harian Sistem diaktifkan (07:00 WIB).');

  schedule(
    '0 7 * * *',
    async () => {
      const jobStart = new Date();

      const timeString = jobStart.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
      console.log(`[DailyReport] Memulai job pada ${timeString}`);

      try {
        const endOfYesterday = new Date(jobStart);
        endOfYesterday.setHours(0, 0, 0, 0);

        const startOfYesterday = new Date(endOfYesterday);
        startOfYesterday.setDate(endOfYesterday.getDate() - 1);

        const dateFilter = {
          alert_timestamp: { gte: startOfYesterday, lt: endOfYesterday },
          NOT: { title: { startsWith: 'Laporan' } },
        };

        const [statsByStatus, topIssues, cronReports] = await Promise.all([
          prisma.alert.groupBy({
            by: ['status'],
            where: dateFilter,
            _count: { _all: true },
          }),

          prisma.alert.groupBy({
            by: ['title'],
            where: dateFilter,
            _count: { title: true },
            orderBy: { _count: { title: 'desc' } },
            take: 3,
          }),

          prisma.alert.findMany({
            where: {
              title: { startsWith: 'Laporan Kinerja' },
              alert_timestamp: { gte: startOfYesterday, lt: endOfYesterday },
            },
            select: { title: true, description: true },
          }),
        ]);

        const totalAlerts = statsByStatus.reduce((acc, curr) => acc + curr._count._all, 0);

        const statusBreakdown = statsByStatus
          .map((s) => `- **${s.status}**: ${s._count._all}`)
          .join('\n');

        let report = `📊 **Laporan Harian Sistem**\n`;
        report += `📅 Tanggal: ${formatDate(startOfYesterday)}\n\n`;

        report += `**Ringkasan Aktivitas:**\n`;
        report += `- Total Alert Masuk: ${totalAlerts}\n`;
        if (totalAlerts > 0) {
          report += `Status Terakhir:\n${statusBreakdown}\n`;
        }
        report += `\n`;

        report += `**🔥 Top 3 Masalah Terbanyak:**\n`;
        if (topIssues.length > 0) {
          topIssues.forEach((issue, idx) => {
            report += `${idx + 1}. ${issue.title} (${issue._count.title}x)\n`;
          });
        } else {
          report += `- Sistem stabil, tidak ada isu dominan.\n`;
        }
        report += `\n`;

        report += `**🤖 Laporan Tugas Otomatis:**\n`;
        if (cronReports.length > 0) {
          cronReports.forEach((r) => (report += `- ✅ ${r.title}\n`));
        } else {
          report += `- Tidak ada laporan kinerja otomatis tercatat.\n`;
        }

        await alertService.create({
          title: `Laporan Harian: ${formatDate(startOfYesterday)}`,
          description: report,
        });

        console.log(`[DailyReport] Sukses. Total Alert: ${totalAlerts}`);
      } catch (error) {
        console.error('[DailyReport] Gagal:', error);

        await alertService.create({
          title: 'System Error: Daily Report Failed',
          description: `Gagal generate laporan. Error: ${(error as Error).message}`,
        });
      }
    },
    {
      timezone: 'Asia/Jakarta',
    },
  );
}
