import { type Request, type Response } from 'express';
import { auditLogService } from './audit-log.service.js';

export const auditLogController = {
  show: async (req: Request, res: Response) => {
    try {
      const { query } = res.locals.validatedData;

      const result = await auditLogService.show(query);

      return res.status(200).json({
        status: 'success',
        message: 'Audit logs retrieved successfully',
        ...result,
      });
    } catch (error: any) {
      return res.status(400).json({ status: 'fail', message: error.message });
    }
  },

  forbidden: (req: Request, res: Response) => {
    return res.status(405).json({
      status: 'fail',
      message: 'Method Not Allowed: Audit logs are immutable and cannot be modified or deleted.',
    });
  },
};
