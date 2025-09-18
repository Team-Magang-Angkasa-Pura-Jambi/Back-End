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
            type_name: 'Electricity',
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
