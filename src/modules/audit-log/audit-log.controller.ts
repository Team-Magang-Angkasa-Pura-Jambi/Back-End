import { type Request, type Response } from 'express';
import { auditLogService } from './audit-log.service.js';
import { res200 } from '../../utils/response.js';

export const auditLogController = {
  show: async (req: Request, res: Response) => {
    const { query } = res.locals.validatedData;

    const result = await auditLogService.show(query);

    return res200({
      res,
      message: 'Audit logs retrieved successfully',
      data: result.data,
      meta: result.meta,
    });
  },

  forbidden: (req: Request, res: Response) => {
    return res.status(405).json({
      status: 'fail',
      message: 'Method Not Allowed: Audit logs are immutable and cannot be modified or deleted.',
    });
  },
};
