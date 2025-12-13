import { describe, it, beforeEach, expect, vi, afterEach } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

// 1. IMPORT SERVICE & DEPENDENCIES
import { ReadingService } from '../reading.service.js'; // Import Class
import prisma from '../../configs/db.js';
import { Prisma } from '../../generated/prisma/index.js';

// Import services lain untuk di-mock
import { Error400, Error404, Error409 } from '../../utils/customError.js';

// 2. MOCK MODULES
vi.mock('../../configs/db.js', () => ({ default: mockDeep<PrismaClient>() }));
vi.mock('../machineLearning.service.js');
vi.mock('../dailyLogbook.service.js');
vi.mock('../notification.service.js');
vi.mock('../alert.service.js');
vi.mock('../analysis.service.js', () => {
  return {
    // Kita return Class beneran, bukan vi.fn() biasa
    AnalysisService: class {
      runPredictionForDate = vi.fn(); // Mock method di dalamnya
    },
  };
});
describe('ReadingService Test Suite', () => {
  const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
  >;
  let readingService: ReadingService;

  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
    readingService = new ReadingService(); // Instantiate class
  });

  // --- DATA DUMMY UTAMA ---
  const mockUser = { user_id: 1, username: 'admin' };
  const mockDate = new Date('2023-10-25');

  // Meter Listrik Dummy
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
            { reading_type_id: 101, value: 1500 }, // WBP
            { reading_type_id: 102, value: 1000 }, // LWBP
          ],
        },
      ],
    },
    rollover_limit: 999999,
  };

  // --- 1. METHOD: CREATE (ELECTRICITY) ---
  describe('Method: create() - Electricity', () => {
    const inputElec = {
      meter_id: 10,
      user_id: 1,
      reading_date: mockDate,
      details: [
        { reading_type_id: 101, value: 1200 }, // WBP Current
        { reading_type_id: 102, value: 2500 }, // LWBP Current
      ],
    };

    // --- 1. METHOD: CREATE (ELECTRICITY) ---
    it('Harus sukses create session & hitung biaya listrik (WBP/LWBP) dengan benar', async () => {
      // FIX 1: Gunakan Prisma.Decimal
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

      // Mock Setup
      prismaMock.meter.findUnique.mockResolvedValue(mockMeterElec as any);

      prismaMock.readingSession.findUnique
        .mockResolvedValueOnce(null) // 1. Cek Duplikat
        .mockResolvedValueOnce(previousSessionData as any) // 2. Validasi H-1
        .mockResolvedValueOnce(null) // 3. _findOrCreateSession
        .mockResolvedValueOnce(currentSessionData as any) // 4. _updateDailySummary
        .mockResolvedValueOnce(previousSessionData as any); // 5. _calculateElectricitySummary

      prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
      prismaMock.readingSession.create.mockResolvedValue({
        session_id: 100,
      } as any);

      // FIX 2: Mock Return Value untuk Upsert (Supaya summary_id terbaca)
      prismaMock.dailySummary.upsert.mockResolvedValue({
        summary_id: 888, // ID Dummy
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

      prismaMock.meter.findUniqueOrThrow.mockResolvedValue(
        mockMeterElec as any
      );
      prismaMock.priceScheme.findFirst.mockResolvedValue(
        mockMeterElec.tariff_group.price_schemes[0] as any
      );
      prismaMock.readingSession.findUniqueOrThrow.mockResolvedValue({
        session_id: 100,
        ...inputElec,
      } as any);

      // ACT
      await readingService.create(inputElec as any);

      // ASSERT
      expect(prismaMock.dailySummary.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ meter_id: 10 }),
        })
      );
      expect(prismaMock.summaryDetail.createMany).toHaveBeenCalled();
    });
  });

  // --- 2. METHOD: CREATE (FUEL - BBM) ---
  describe('Method: create() - Fuel (BBM)', () => {
    const mockMeterFuel = {
      meter_id: 20,
      meter_code: 'FUEL-01',
      energy_type: { type_name: 'Fuel', unit_of_measurement: 'Liter' },
      tank_height_cm: 200, // Tinggi tangki 200cm
      tank_volume_liters: 2000, // Volume 2000 Liter (1 cm = 10 Liter)
      tariff_group: {
        price_schemes: [{ rates: [{ reading_type_id: 201, value: 10000 }] }], // Harga Solar Rp 10.000
      },
    };

    const inputFuel = {
      meter_id: 20,
      reading_date: mockDate,
      details: [{ reading_type_id: 201, value: 150 }], // Tinggi saat ini 150cm
    };

    it('Harus error jika input ketinggian melebihi tinggi tangki', async () => {
      // Mock Meter
      prismaMock.meter.findUnique.mockResolvedValue(mockMeterFuel as any);

      const invalidInput = {
        ...inputFuel,
        details: [{ reading_type_id: 201, value: 250 }],
      }; // 250cm > 200cm

      await expect(readingService.create(invalidInput as any)).rejects.toThrow(
        Error400
      ); // Harus throw Error400
    });

    // --- 2. METHOD: CREATE (FUEL - BBM) ---
    it('Harus menghitung konsumsi BBM berdasarkan selisih tinggi cm -> liter', async () => {
      // 1. SETUP DATA DUMMY KHUSUS FUEL (Wajib Decimal)
      const mockMeterFuelDecimal = {
        meter_id: 20,
        meter_code: 'FUEL-01',
        energy_type: { type_name: 'Fuel', unit_of_measurement: 'Liter' },
        energy_type_id: 2,
        // PENTING: Gunakan Prisma.Decimal agar .isZero() jalan
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

      // Input dari User (Current Height 150cm)
      const inputFuelData = {
        meter_id: 20,
        reading_date: mockDate,
        details: [{ reading_type_id: 201, value: 150 }], // Service akan convert ke Decimal
      };

      // Mock Data Sesi Saat Ini (Seolah sudah tersimpan di DB)
      const currentSessionFuel = {
        session_id: 200,
        meter_id: 20,
        reading_date: mockDate,
        details: [{ reading_type_id: 201, value: new Prisma.Decimal(150) }],
      };

      // 2. MOCK DATABASE RESPONSES

      // A. Mock Meter
      prismaMock.meter.findUnique.mockResolvedValue(
        mockMeterFuelDecimal as any
      );

      // B. Mock Sequence ReadingSession.findUnique (Total 3 Kali)
      prismaMock.readingSession.findUnique
        .mockResolvedValueOnce(null) // 1. Cek Duplikat (Aman)
        .mockResolvedValueOnce(null) // 2. _findOrCreateSession (Belum ada)
        .mockResolvedValueOnce(currentSessionFuel as any); // 3. _updateDailySummary (Ambil Current untuk dihitung)

      // C. Mock Previous Session (H-1 / Data Terakhir)
      // Kemarin 160cm. Sekarang 150cm. Selisih 10cm.
      prismaMock.readingSession.findFirst.mockResolvedValue({
        details: [{ reading_type_id: 201, value: new Prisma.Decimal(160) }],
      } as any);

      // D. Mock Upsert Return Value (PENTING biar gak crash)
      prismaMock.dailySummary.upsert.mockResolvedValue({
        summary_id: 777,
      } as any);

      // E. Mock Transaction & Lainnya
      prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
      prismaMock.readingSession.create.mockResolvedValue({
        session_id: 200,
      } as any);
      prismaMock.meter.findUniqueOrThrow.mockResolvedValue(
        mockMeterFuelDecimal as any
      );

      // F. Mock Helper Lookups
      prismaMock.readingType.findFirst.mockResolvedValue({
        reading_type_id: 201,
      } as any);
      prismaMock.priceScheme.findFirst.mockResolvedValue(
        mockMeterFuelDecimal.tariff_group.price_schemes[0] as any
      );
      prismaMock.readingSession.findUniqueOrThrow.mockResolvedValue({
        session_id: 200,
      } as any);

      // 3. ACT (Jalankan)
      await readingService.create(inputFuelData as any);

      // 4. ASSERT (Pembuktian)

      // Pastikan upsert dipanggil (artinya kalkulasi sukses sampai akhir)
      expect(prismaMock.dailySummary.upsert).toHaveBeenCalled();

      // Validasi Perhitungan Logic:
      // Tinggi 150cm.
      // Rasio = 2000 Liter / 200 cm = 10 Liter/cm.
      // Sisa Stok = 150 * 10 = 1500 Liter.

      expect(prismaMock.summaryDetail.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              // Kita cek apakah field remaining_stock ada dan berupa Decimal/Angka
              remaining_stock: expect.anything(),
            }),
          ]),
        })
      );
    });
  });

  // --- 3. VALIDASI UMUM ---
  describe('Validations', () => {
    it('Harus melempar Error409 jika data tanggal tersebut SUDAH ADA (Duplicate)', async () => {
      prismaMock.meter.findUnique.mockResolvedValue(mockMeterElec as any);

      // Mock menemukan sesi duplikat
      prismaMock.readingSession.findUnique.mockResolvedValue({
        session_id: 1,
      } as any);

      await expect(
        readingService.create({
          meter_id: 10,
          reading_date: mockDate,
          details: [],
        } as any)
      ).rejects.toThrow(Error409);
    });

    it('Harus melempar Error400 jika data H-1 TIDAK ADA (Loncat hari)', async () => {
      prismaMock.meter.findUnique.mockResolvedValue(mockMeterElec as any);
      prismaMock.readingSession.findUnique.mockResolvedValue(null); // No duplicate

      // Mock H-1 return null
      prismaMock.readingSession.findUnique
        .mockResolvedValueOnce(null) // Duplicate check
        .mockResolvedValueOnce(null); // Previous session check

      // Mock "Any Previous Entry" (ada data bulan lalu, tapi kemarin kosong)
      prismaMock.readingSession.findFirst.mockResolvedValue({
        session_id: 5,
      } as any);

      await expect(
        readingService.create({
          meter_id: 10,
          reading_date: mockDate,
          details: [],
        } as any)
      ).rejects.toThrow(Error400); // Pesan: "Silakan input data hari sebelumnya"
    });
  });
});
