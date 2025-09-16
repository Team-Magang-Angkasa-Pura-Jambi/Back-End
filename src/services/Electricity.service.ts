import prisma from '../configs/db.js';
import type { ReadingSessionCreateInput } from '../types/electricity.type.js';

export class ElectricityService {
  public async findAll() {
    const electricityReadings = await prisma.readingSession.findMany({
      where: {
        meter: {
          energy_type: {
            type_name: 'Electricity',
          },
        },
      },
      include: {
        meter: true,
        user: {
          select: {
            user_id: true,
            username: true,
          },
        },
        details: {
          include: {
            reading_type: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return electricityReadings;
  }

  public async findById(sessionId: number) {
    const readingSession = await prisma.readingSession.findUnique({
      where: {
        session_id: sessionId,

        meter: {
          energy_type: {
            type_name: 'Listrik',
          },
        },
      },
      include: {
        meter: true,
        user: {
          select: { user_id: true, username: true },
        },
        details: {
          include: {
            reading_type: true,
          },
        },
      },
    });

    return readingSession;
  }

  public async create(data: ReadingSessionCreateInput) {
    const { meter_id, user_id, timestamp, details } = data;
    const readingDate = new Date(timestamp);
    readingDate.setUTCHours(0, 0, 0, 0);
    return prisma.$transaction(async (tx) => {
      const newSession = await tx.readingSession.create({
        data: {
          meter_id,
          user_id,
          timestamp,
          reading_date: readingDate,
        },
      });

      const detailData = details.map((detail) => ({
        session_id: newSession.session_id,
        reading_type_id: detail.reading_type_id,
        value: detail.value,
      }));

      await tx.readingDetail.createMany({
        data: detailData,
      });

      return tx.readingSession.findUnique({
        where: { session_id: newSession.session_id },
        include: {
          details: {
            include: {
              reading_type: true,
            },
          },
        },
      });
    });
  }

  public async createCorrection(
    originalSessionId: number,
    correctionData: ReadingSessionCreateInput
  ) {
    const { meter_id, user_id, timestamp, details } = correctionData;

    return prisma.$transaction(async (tx) => {
      const newCorrectionSession = await tx.readingSession.create({
        data: {
          meter_id,
          user_id,
          timestamp,
          is_correction_for_id: originalSessionId,
        },
      });

      const detailData = details.map((detail) => ({
        session_id: newCorrectionSession.session_id,
        reading_type_id: detail.reading_type_id,
        value: detail.value,
      }));

      await tx.readingDetail.createMany({
        data: detailData,
      });

      return tx.readingSession.findUnique({
        where: { session_id: newCorrectionSession.session_id },
        include: { details: true, correction_for: true },
      });
    });
  }

  public async delete(sessionId: number) {
    return prisma.$transaction(async (tx) => {
      await tx.readingDetail.deleteMany({
        where: { session_id: sessionId },
      });

      const deletedSession = await tx.readingSession.delete({
        where: { session_id: sessionId },
      });

      return deletedSession;
    });
  }

  public async getLatestReadingForMeter(meterId: number) {
    const latestReading = await prisma.readingSession.findFirst({
      where: {
        meter_id: meterId,
      },
      include: {
        details: {
          include: {
            reading_type: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return latestReading;
  }
}

export const electricityService = new ElectricityService();
