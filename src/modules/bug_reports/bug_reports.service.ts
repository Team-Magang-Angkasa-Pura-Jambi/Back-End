import { handlePrismaError } from '../../common/utils/prismaError.js';
import prisma from '../../configs/db.js';
import { type Prisma } from '../../generated/prisma/index.js';
import { serverLoggerService } from '../system_monitor/server_logger.service.js';

export interface CreateBugReportPayload {
  title: string;
  description: string;
  category?: 'UI_BUG' | 'CALCULATION_ERROR' | 'API_FAILURE' | 'DATA_MISMATCH' | 'PERFORMANCE' | 'FEATURE_REQUEST' | 'OTHER';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  page_url?: string | null;
  browser_info?: any;
  error_stack?: string | null;
  screenshot_url?: string | null;
}

export interface UpdateBugReportStatusPayload {
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
  developer_response?: string | null;
}

export const bugReportService = {
  store: async (payload: CreateBugReportPayload, reporterId: number) => {
    try {
      const data = await prisma.bugReport.create({
        data: {
          title: payload.title,
          description: payload.description,
          category: payload.category || 'UI_BUG',
          severity: payload.severity || 'MEDIUM',
          page_url: payload.page_url,
          browser_info: payload.browser_info ?? undefined,
          error_stack: payload.error_stack,
          screenshot_url: payload.screenshot_url,
          reporter_id: reporterId,
          status: 'OPEN',
        },
        include: {
          reporter: {
            select: {
              user_id: true,
              username: true,
              full_name: true,
              email: true,
              role: { select: { role_name: true } },
            },
          },
        },
      });

      // 1. Catat ke Monitoring Server Logger agar Developer langsung melihat alert
      serverLoggerService.log(
        data.severity === 'CRITICAL' ? 'ERROR' : data.severity === 'HIGH' ? 'WARN' : 'INFO',
        `[Bug Report #${data.report_id.slice(0, 8)}] ${data.title} (${data.category}) dilaporkan oleh ${data.reporter.username}`,
        'BugTracker',
        {
          endpoint: data.page_url || '/bug-reports',
          request: {
            method: 'POST',
            url: data.page_url || '/bug-reports',
            ip: '127.0.0.1',
            body: {
              report_id: data.report_id,
              title: data.title,
              severity: data.severity,
              category: data.category,
              reporter: data.reporter.username,
            },
          },
          response: {
            statusCode: 201,
            durationMs: 0,
            body: data,
          },
          ...(data.error_stack && {
            error: {
              name: `BugReport:${data.category}`,
              message: data.title,
              stack: data.error_stack,
            },
          }),
        },
      );

      return data;
    } catch (error) {
      return handlePrismaError(error, 'Bug Report');
    }
  },

  show: async (
    id?: string,
    query?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      severity?: string;
      category?: string;
    },
  ) => {
    try {
      if (id) {
        return await prisma.bugReport.findUnique({
          where: { report_id: id },
          include: {
            reporter: {
              select: {
                user_id: true,
                username: true,
                full_name: true,
                email: true,
                role: { select: { role_name: true } },
              },
            },
          },
        });
      }

      const page = Number(query?.page) || 1;
      const limit = Number(query?.limit) || 15;
      const skip = (page - 1) * limit;

      const where: Prisma.BugReportWhereInput = {};

      if (query?.search) {
        where.OR = [
          { title: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
          { page_url: { contains: query.search, mode: 'insensitive' } },
          { reporter: { username: { contains: query.search, mode: 'insensitive' } } },
        ];
      }

      if (query?.status && query.status !== 'ALL') {
        where.status = query.status as any;
      }

      if (query?.severity && query.severity !== 'ALL') {
        where.severity = query.severity as any;
      }

      if (query?.category && query.category !== 'ALL') {
        where.category = query.category as any;
      }

      const [data, total, stats] = await Promise.all([
        prisma.bugReport.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
          include: {
            reporter: {
              select: {
                user_id: true,
                username: true,
                full_name: true,
                email: true,
                role: { select: { role_name: true } },
              },
            },
          },
        }),
        prisma.bugReport.count({ where }),
        prisma.bugReport.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
      ]);

      const statusCounts = {
        OPEN: 0,
        IN_PROGRESS: 0,
        RESOLVED: 0,
        REJECTED: 0,
      };

      stats.forEach((s) => {
        if (s.status in statusCounts) {
          statusCounts[s.status as keyof typeof statusCounts] = s._count._all;
        }
      });

      return {
        data,
        summary: {
          total_all: Object.values(statusCounts).reduce((a, b) => a + b, 0),
          ...statusCounts,
        },
        meta: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      return handlePrismaError(error, 'Bug Report');
    }
  },

  updateStatus: async (id: string, payload: UpdateBugReportStatusPayload) => {
    try {
      const isResolved = payload.status === 'RESOLVED';

      return await prisma.bugReport.update({
        where: { report_id: id },
        data: {
          status: payload.status,
          developer_response: payload.developer_response,
          ...(isResolved && { resolved_at: new Date() }),
          ...(!isResolved && { resolved_at: null }),
        },
        include: {
          reporter: {
            select: {
              user_id: true,
              username: true,
              full_name: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      return handlePrismaError(error, 'Bug Report');
    }
  },

  remove: async (id: string) => {
    try {
      return await prisma.bugReport.delete({
        where: { report_id: id },
      });
    } catch (error) {
      return handlePrismaError(error, 'Bug Report');
    }
  },
};
