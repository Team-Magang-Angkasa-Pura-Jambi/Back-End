import { describe, it, beforeEach, expect, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { type PrismaClient } from '@prisma/client';

import { ReadingService } from '../metering/reading.service.js';
import prisma from '../../configs/db.js';
import { Prisma } from '../../generated/prisma/index.js';

import { Error400, Error409 } from '../../utils/customError.js';

vi.mock('../../configs/db.js', () => ({ default: mockDeep<PrismaClient>() }));
vi.mock('../machineLearning.service.js');
vi.mock('../dailyLogbook.service.js');
vi.mock('../notification.service.js');
vi.mock('../alert.service.js');
vi.mock('../analysis.service.js', () => {
  return {
    AnalysisService: class {
      runPredictionForDate = vi.fn();
    },
  };
});
describe('ReadingService Test Suite', () => {
  const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;
  let readingService: ReadingService;

  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
    readingService = new ReadingService();
  });

  const mockUser = { user_id: 1, username: 'admin' };
  const mockDate = new Date('2023-10-25');

  const mockMeterElec = {
    meter_id: 10,
    meter_code: 'ELEC-01',
    energy_type: { type_name: 'Electricity', unit_of_measurement: 'kWh' },
    tariff_group: {
      group_code: 'B2',
      faktor_kali: 1,
      price_schemes: [
        {
          scheme_name: 'Tarif 2023',
          effective_date: new Date('2023-01-01'),
          is_active: true,
          rates: [
            { reading_type_id: 101, value: 1500 },
            { reading_type_id: 102, value: 1000 },
          ],
        },
      ],
    },
    rollover_limit: 999999,
  };

  describe('Method: create() - Electricity', () => {
    const inputElec = {
      meter_id: 10,
      user_id: 1,
      reading_date: mockDate,
      details: [
        { reading_type_id: 101, value: 1200 },
        { reading_type_id: 102, value: 2500 },
      ],
    };

    it('Harus sukses create session & hitung biaya listrik (WBP/LWBP) dengan benar', async () => {
      const previousSessionData = {
        session_id: 9,
        details: [
          { reading_type_id: 101, value: new Prisma.Decimal(1100) },
          { reading_type_id: 102, value: new Prisma.Decimal(2400) },
        ],
      };

      const currentSessionData = {
        session_id: 100,
        meter_id: 10,
        reading_date: mockDate,
        details: [
          { reading_type_id: 101, value: new Prisma.Decimal(1200) },
          { reading_type_id: 102, value: new Prisma.Decimal(2500) },
        ],
      };

      prismaMock.meter.findUnique.mockResolvedValue(mockMeterElec as any);

      prismaMock.readingSession.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(previousSessionData as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(currentSessionData as any)
        .mockResolvedValueOnce(previousSessionData as any);

      prismaMock.$transaction.mockImplementation(async (cb: any) => await cb(prismaMock));
      prismaMock.readingSession.create.mockResolvedValue({
        session_id: 100,
      } as any);

      prismaMock.dailySummary.upsert.mockResolvedValue({
        summary_id: 888,
        total_cost: new Prisma.Decimal(250000),
        total_consumption: new Prisma.Decimal(200),
      } as any);

      prismaMock.readingType.findUnique
        .mockResolvedValueOnce({
          reading_type_id: 101,
          type_name: 'WBP',
        } as any)
        .mockResolvedValueOnce({
          reading_type_id: 102,
          type_name: 'LWBP',
        } as any);

      prismaMock.meter.findUniqueOrThrow.mockResolvedValue(mockMeterElec as any);
      prismaMock.priceScheme.findFirst.mockResolvedValue(
        mockMeterElec.tariff_group.price_schemes[0] as any,
      );
      prismaMock.readingSession.findUniqueOrThrow.mockResolvedValue({
        session_id: 100,
        ...inputElec,
      } as any);

      await readingService.create(inputElec as any);

      expect(prismaMock.dailySummary.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ meter_id: 10 }),
        }),
      );
      expect(prismaMock.summaryDetail.createMany).toHaveBeenCalled();
    });
  });

  describe('Method: create() - Fuel (BBM)', () => {
    const mockMeterFuel = {
      meter_id: 20,
      meter_code: 'FUEL-01',
      energy_type: { type_name: 'Fuel', unit_of_measurement: 'Liter' },
      tank_height_cm: 200,
      tank_volume_liters: 2000,
      tariff_group: {
        price_schemes: [{ rates: [{ reading_type_id: 201, value: 10000 }] }],
      },
    };

    const inputFuel = {
      meter_id: 20,
      reading_date: mockDate,
      details: [{ reading_type_id: 201, value: 150 }],
    };

    it('Harus error jika input ketinggian melebihi tinggi tangki', async () => {
      prismaMock.meter.findUnique.mockResolvedValue(mockMeterFuel as any);

      const invalidInput = {
        ...inputFuel,
        details: [{ reading_type_id: 201, value: 250 }],
      };

      await expect(readingService.create(invalidInput as any)).rejects.toThrow(Error400);
    });

    it('Harus menghitung konsumsi BBM berdasarkan selisih tinggi cm -> liter', async () => {
      const mockMeterFuelDecimal = {
        meter_id: 20,
        meter_code: 'FUEL-01',
        energy_type: { type_name: 'Fuel', unit_of_measurement: 'Liter' },
        energy_type_id: 2,

        tank_height_cm: new Prisma.Decimal(200),
        tank_volume_liters: new Prisma.Decimal(2000),
        tariff_group: {
          group_code: 'Solar-Industri',
          price_schemes: [
            {
              scheme_name: 'Harga Solar',
              effective_date: new Date('2023-01-01'),
              is_active: true,
              rates: [{ reading_type_id: 201, value: 10000 }],
            },
          ],
        },
        category: { name: 'Genset' },
        tariff_group_id: 5,
      };

      const inputFuelData = {
        meter_id: 20,
        reading_date: mockDate,
        details: [{ reading_type_id: 201, value: 150 }],
      };

      const currentSessionFuel = {
        session_id: 200,
        meter_id: 20,
        reading_date: mockDate,
        details: [{ reading_type_id: 201, value: new Prisma.Decimal(150) }],
      };

      prismaMock.meter.findUnique.mockResolvedValue(mockMeterFuelDecimal as any);

      prismaMock.readingSession.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(currentSessionFuel as any);

      prismaMock.readingSession.findFirst.mockResolvedValue({
        details: [{ reading_type_id: 201, value: new Prisma.Decimal(160) }],
      } as any);

      prismaMock.dailySummary.upsert.mockResolvedValue({
        summary_id: 777,
      } as any);

      prismaMock.$transaction.mockImplementation(async (cb: any) => await cb(prismaMock));
      prismaMock.readingSession.create.mockResolvedValue({
        session_id: 200,
      } as any);
      prismaMock.meter.findUniqueOrThrow.mockResolvedValue(mockMeterFuelDecimal as any);

      prismaMock.readingType.findFirst.mockResolvedValue({
        reading_type_id: 201,
      } as any);
      prismaMock.priceScheme.findFirst.mockResolvedValue(
        mockMeterFuelDecimal.tariff_group.price_schemes[0] as any,
      );
      prismaMock.readingSession.findUniqueOrThrow.mockResolvedValue({
        session_id: 200,
      } as any);

      await readingService.create(inputFuelData as any);

      expect(prismaMock.dailySummary.upsert).toHaveBeenCalled();

      expect(prismaMock.summaryDetail.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              remaining_stock: expect.anything(),
            }),
          ]),
        }),
      );
    });
  });

  describe('Validations', () => {
    it('Harus melempar Error409 jika data tanggal tersebut SUDAH ADA (Duplicate)', async () => {
      prismaMock.meter.findUnique.mockResolvedValue(mockMeterElec as any);

      prismaMock.readingSession.findUnique.mockResolvedValue({
        session_id: 1,
      } as any);

      await expect(
        readingService.create({
          meter_id: 10,
          reading_date: mockDate,
          details: [],
        } as any),
      ).rejects.toThrow(Error409);
    });

    it('Harus melempar Error400 jika data H-1 TIDAK ADA (Loncat hari)', async () => {
      prismaMock.meter.findUnique.mockResolvedValue(mockMeterElec as any);
      prismaMock.readingSession.findUnique.mockResolvedValue(null);

      prismaMock.readingSession.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      prismaMock.readingSession.findFirst.mockResolvedValue({
        session_id: 5,
      } as any);

      await expect(
        readingService.create({
          meter_id: 10,
          reading_date: mockDate,
          details: [],
        } as any),
      ).rejects.toThrow(Error400);
    });
  });
});
