import { Router } from 'express';
import { systemMonitorController } from './system_monitor.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const systemMonitorRoute = (router: Router) => {
  const prefix = '/system-monitor';

  router.get(`${prefix}/logs`, asyncHandler(systemMonitorController.getLogs));
  router.get(`${prefix}/metrics`, asyncHandler(systemMonitorController.getMetrics));
  router.post(`${prefix}/clear-logs`, asyncHandler(systemMonitorController.clearLogs));
};
