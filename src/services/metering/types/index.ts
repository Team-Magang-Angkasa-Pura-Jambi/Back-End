import {
  Prisma,
  ReadingDetail,
  ReadingSession,
} from '../../../generated/prisma/index.js';
import { CreateReadingSessionBody } from '../../../types/metering/reading.types.js';

export type CreateReadingSessionInternal = CreateReadingSessionBody & {
  user_id: number;
  reading_date: Date;
};

export type MeterWithRelations = Prisma.MeterGetPayload<{
  include: {
    energy_type: true;
    category: true;
    tariff_group: {
      include: { price_schemes: { include: { rates: true; taxes: true } } };
    };
  };
}>;

export type SessionWithDetails = ReadingSession & { details: ReadingDetail[] };

export type ReadingSessionWithDetails = Prisma.ReadingSessionGetPayload<{
  include: {
    meter: { include: { energy_type: true; category: true } };
    user: { select: { user_id: true; username: true } };
    details: { include: { reading_type: true } };
  };
}>;

// 1. Definisikan struktur hasil query Prisma (ReadingSession + Relations)
export type ReadingSessionWithRelations = Prisma.ReadingSessionGetPayload<{
  include: {
    meter: {
      include: {
        energy_type: true;
        daily_logbooks: true;
      };
    };
    user: {
      select: {
        username: true;
      };
    };
    details: {
      include: {
        reading_type: {
          select: {
            type_name: true;
          };
        };
      };
    };
  };
}>;

// 2. Definisikan struktur final setelah digabung dengan data Pax
export type ReadingHistoryItem = ReadingSessionWithRelations & {
  paxData: PaxData;
};

export type PaxData = {
  pax: number | null;
  pax_id: number | null;
};

// 3. Definisikan tipe return function
export type GetHistoryResponse = {
  data: ReadingHistoryItem[];
  message: string;
};
