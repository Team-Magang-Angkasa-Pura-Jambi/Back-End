// Generated for Sentinel Projectimport { Prisma } from '../../../generated/prisma/index.js';

import { type Prisma } from '../../generated/prisma/index.js';

export interface DailySummaryQuery {
  meter_id?: number;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

// Tipe data untuk response satu baris summary
export type DailySummaryWithDetails = Prisma.DailySummaryGetPayload<{
  include: {
    summary_details: true;
    meter: { select: { name: true; meter_code: true } };
  };
}>;
