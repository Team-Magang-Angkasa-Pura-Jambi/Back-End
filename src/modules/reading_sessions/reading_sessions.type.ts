// Generated for Sentinel Projectimport { Prisma } from '../../generated/prisma/index.js';

export interface CreateReadingPayload {
  reading: {
    meter_id: number;
    reading_date: Date;
    evidence_image_url?: string | null;
    notes?: string | null;
    details: {
      reading_type_id: number;
      value: number;
    }[];
  };
}

export interface ReadingQuery {
  meter_id?: number;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}
