import { Request, Response } from 'express';
import { serverLoggerService } from './server_logger.service.js';
import { res200 } from '../../utils/response.js';
import prisma from '../../configs/db.js';
import axios from 'axios';
import { systemConfigService } from '../system_config/system_config.service.js';

export const systemMonitorController = {
  getLogs: async (req: Request, res: Response) => {
    const level = (req.query.level as string) || 'ALL';
    const search = (req.query.search as string) || '';
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const result = serverLoggerService.getLogs({ level, search, limit, offset });

    return res200({
      res,
      message: 'Berhasil memuat log aktivitas server',
      data: result,
    });
  },

  getMetrics: async (req: Request, res: Response) => {
    const metrics = serverLoggerService.getSystemMetrics();

    // Check DB status
    let dbStatus = 'healthy';
    let dbLatencyMs = 0;
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
    } catch (err: any) {
      dbStatus = 'unhealthy';
      dbLatencyMs = Date.now() - dbStart;
    }

    // Check ML status
    let mlStatus = 'unknown';
    let mlLatencyMs = 0;
    try {
      const config = await systemConfigService.getConfig();
      const mlBaseUrl = config.endpoints.ml_api_base_url || 'http://localhost:8000';
      const mlStart = Date.now();
      const mlRes = await axios.get(`${mlBaseUrl}/health`, { timeout: 3000 });
      mlLatencyMs = Date.now() - mlStart;
      mlStatus = mlRes.status === 200 ? 'online' : 'error';
    } catch (err) {
      mlStatus = 'offline';
    }

    return res200({
      res,
      message: 'Berhasil memuat metrik performa sistem server',
      data: {
        ...metrics,
        health: {
          database: {
            status: dbStatus,
            latency_ms: dbLatencyMs,
          },
          machine_learning: {
            status: mlStatus,
            latency_ms: mlLatencyMs,
          },
        },
      },
    });
  },

  clearLogs: async (req: Request, res: Response) => {
    serverLoggerService.clearLogs();

    return res200({
      res,
      message: 'Semua log server dalam buffer berhasil dibersihkan',
    });
  },
};
