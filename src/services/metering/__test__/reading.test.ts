import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type DeepMockProxy } from 'vitest-mock-extended';
import { type PrismaClient } from '@prisma/client';

// --- 1. SETUP MOCK DATABASE ---
vi.mock('../../configs/db.js', async () => {
  const actualLib = await import('vitest-mock-extended');
  return {
    __esModule: true,
    default: actualLib.mockDeep<PrismaClient>(),
  };
});

// --- 2. MOCK EXTERNAL SERVICES & HELPERS ---

// Mock Helper Validator (Lokasi: src/services/metering/helpers -> ../helpers)
vi.mock('../helpers/reading-validator.js', () => ({
  _validateMeter: vi.fn(),
  _normalizeDate: vi.fn((d) => new Date(d)),
  _validateDuplicateSession: vi.fn(),
  _validateReadingsAgainstPrevious: vi.fn(),
  _checkAndResolveMissingDataAlert: vi.fn(),
  _checkUsageAgainstTargetAndNotify: vi.fn(),
}));

// Mock Helper Summarizer (Lokasi: src/services/metering/helpers -> ../helpers)
vi.mock('../helpers/reading-summarizer.js', () => ({
  _findOrCreateSession: vi.fn(),
  _createReadingDetails: vi.fn(),
  _updateDailySummary: vi.fn(),
  _buildWhereClause: vi.fn(() => ({})),
  _buildOrderByClause: vi.fn(() => ({})),
}));

// --- FIX PATH DI SINI (Harus ../../ karena keluar dari metering) ---

// Mock Intelligence Services (Lokasi: src/services/intelligence -> ../../intelligence)
vi.mock('../../intelligence/predict.service.js', () => ({
  predictTerminal: vi.fn(),
  predictOffice: vi.fn(),
}));

vi.mock('../../intelligence/classify.service.js', () => ({
  classifyOffice: vi.fn(),
  classifyTerminal: vi.fn(),
}));

// Mock Logbook Service (Lokasi: src/services/operations -> ../../operations)
vi.mock('../../operations/dailyLogbook.service.js', () => ({
  dailyLogbookService: {
    generateDailyLog: vi.fn(),
  },
}));

// --- 3. IMPORT MODULES ---
import { ReadingService } from '../reading.service.js';
import * as validator from '../helpers/reading-validator.js';
import * as summarizer from '../helpers/reading-summarizer.js';
// Import path di bawah ini sudah benar, jadi vi.mock di atas harus mencocokkannya
import * as predictor from '../../intelligence/predict.service.js';
import * as classifier from '../../intelligence/classify.service.js';
import prisma from '../../../configs/db.js';
import { dailyLogbookService } from '../../operations/dailyLogbook.service.js';
import { Error400 } from '../../../utils/customError.js';

describe('ReadingService Test Suite', () => {
  let readingService: ReadingService;
  const prismaMock = vi.mocked(prisma, true) as unknown as DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    vi.resetAllMocks();

    // Fix $transaction mock
    prismaMock.$transaction = vi.fn().mockImplementation(async (arg) => {
      if (typeof arg === 'function') {
        return arg(prismaMock);
      }
      return arg;
    }) as any;

    // Manual Define Spy untuk Method Prisma yang dipakai
    prismaMock.readingSession.findUniqueOrThrow = vi.fn();
    prismaMock.readingSession.findFirst = vi.fn();
    prismaMock.readingSession.findMany = vi.fn();
    prismaMock.readingSession.create = vi.fn();
    prismaMock.readingSession.update = vi.fn();
    prismaMock.readingSession.delete = vi.fn();

    prismaMock.readingDetail.deleteMany = vi.fn();
    prismaMock.readingDetail.findFirst = vi.fn();
    prismaMock.meter.findUniqueOrThrow = vi.fn();
    prismaMock.dailySummary.deleteMany = vi.fn();
    prismaMock.dailyLogbook.deleteMany = vi.fn();
    prismaMock.paxData.findMany = vi.fn();

    readingService = new ReadingService();
  });

  // --- DATA DUMMY ---
  const mockDate = new Date('2024-01-01T00:00:00Z');
  const mockMeter = {
    meter_id: 1,
    meter_code: 'M-001',
    category: { name: 'Terminal' },
    energy_type: { type_name: 'Electricity' },
    tariff_group: { price_schemes: [] },
  };

  const mockSession = {
    session_id: 100,
    meter_id: 1,
    reading_date: mockDate,
    meter: mockMeter,
    details: [],
    user: { username: 'test_user' },
  };

  describe('method: create()', () => {
    const createBody = {
      meter_id: 1,
      reading_date: '2024-01-01',
      details: [{ reading_type_id: 1, value: 100 }],
      user_id: 1,
    } as any;

    it('Harus sukses membuat sesi, validasi, summary, dan prediksi (Terminal)', async () => {
      // Setup Mocks
      vi.mocked(validator._validateMeter).mockResolvedValue(mockMeter as any);
      vi.mocked(summarizer._findOrCreateSession).mockResolvedValue({ sessionId: 100 } as any);

      // FIX: Mock Predictor agar return Promise void
      // Karena path vi.mock sudah benar, predictor sekarang adalah Mock Function
      vi.mocked(predictor.predictTerminal).mockResolvedValue(null);
      vi.mocked(predictor.predictOffice).mockResolvedValue(null);

      // Mock return akhir transaction
      prismaMock.readingSession.findUniqueOrThrow.mockResolvedValue(mockSession as any);

      // Execute
      const result = await readingService.create(createBody);

      // Assertions
      expect(validator._validateMeter).toHaveBeenCalledWith(1);
      expect(validator._validateDuplicateSession).toHaveBeenCalled();
      expect(validator._validateReadingsAgainstPrevious).toHaveBeenCalled();

      // Transaction flow
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(summarizer._findOrCreateSession).toHaveBeenCalled();
      expect(summarizer._createReadingDetails).toHaveBeenCalled();
      expect(summarizer._updateDailySummary).toHaveBeenCalled();

      // Alert & Predict
      expect(validator._checkAndResolveMissingDataAlert).toHaveBeenCalled();
      expect(predictor.predictTerminal).toHaveBeenCalled();
      expect(predictor.predictOffice).not.toHaveBeenCalled();

      expect(result).toEqual(mockSession);
    });

    it('Harus memanggil predictOffice jika kategori meter adalah Office', async () => {
      const officeMeter = { ...mockMeter, category: { name: 'Office' } };
      vi.mocked(validator._validateMeter).mockResolvedValue(officeMeter as any);
      vi.mocked(summarizer._findOrCreateSession).mockResolvedValue({ sessionId: 100 } as any);

      vi.mocked(predictor.predictTerminal).mockResolvedValue(null);
      vi.mocked(predictor.predictOffice).mockResolvedValue(null);

      prismaMock.readingSession.findUniqueOrThrow.mockResolvedValue(mockSession as any);

      await readingService.create(createBody);

      expect(predictor.predictOffice).toHaveBeenCalled();
      expect(predictor.predictTerminal).not.toHaveBeenCalled();
    });
  });

  describe('method: update()', () => {
    const updateBody = {
      details: [{ reading_type_id: 1, value: 200 }],
    };

    it('Harus sukses update jika sesi adalah sesi terakhir', async () => {
      // Mock Current Session
      prismaMock.readingSession.findUniqueOrThrow.mockResolvedValue(mockSession as any);

      // Mock Latest Session (Same ID)
      prismaMock.readingSession.findFirst.mockResolvedValue(mockSession as any);

      // Mock helpers dalam processAndSummarizeReading
      // Kita define behavior spesifik untuk pemanggilan meter findUniqueOrThrow
      prismaMock.meter.findUniqueOrThrow.mockResolvedValue(mockMeter as any);

      vi.mocked(summarizer._updateDailySummary).mockResolvedValue([
        { summary_date: mockDate } as any,
      ]);

      // FIX: Mock Classifier
      vi.mocked(classifier.classifyTerminal).mockResolvedValue(undefined);

      // Mock Return Update
      const updatedSession = { ...mockSession, details: updateBody.details };

      // Mock Transaction Calls:
      // Karena findUniqueOrThrow dipanggil 2x (sekali di awal, sekali di akhir tx),
      // kita gunakan mockResolvedValueOnce berurutan.
      prismaMock.readingSession.findUniqueOrThrow
        .mockResolvedValueOnce(mockSession as any) // Awal method
        .mockResolvedValueOnce(updatedSession as any); // Akhir transaction

      // Execute
      await readingService.update(100, updateBody as any);

      // Assertions
      expect(prismaMock.readingDetail.deleteMany).toHaveBeenCalledWith({
        where: { session_id: 100 },
      });
      expect(summarizer._createReadingDetails).toHaveBeenCalled();

      // Validasi flow processAndSummarizeReading
      expect(dailyLogbookService.generateDailyLog).toHaveBeenCalled();
      expect(classifier.classifyTerminal).toHaveBeenCalled();
    });

    it('Harus melempar Error400 jika bukan sesi terakhir', async () => {
      prismaMock.readingSession.findUniqueOrThrow.mockResolvedValue(mockSession as any);

      // Latest session punya ID beda
      prismaMock.readingSession.findFirst.mockResolvedValue({
        ...mockSession,
        session_id: 999,
      } as any);

      await expect(readingService.update(100, updateBody as any)).rejects.toThrow(Error400);

      await expect(readingService.update(100, updateBody as any)).rejects.toThrow(
        'Hanya data pembacaan terakhir yang dapat diubah',
      );
    });
  });

  describe('method: delete()', () => {
    it('Harus sukses delete jika sesi adalah sesi terakhir', async () => {
      // Setup mock transaction find
      prismaMock.readingSession.findUniqueOrThrow.mockResolvedValue(mockSession as any);
      prismaMock.readingSession.findFirst.mockResolvedValue(mockSession as any); // ID sama = latest
      prismaMock.readingSession.delete.mockResolvedValue(mockSession as any); // Return deleted

      // Execute
      await readingService.delete(100);

      // Assertions
      expect(prismaMock.dailySummary.deleteMany).toHaveBeenCalledWith({
        where: { meter_id: mockSession.meter_id, summary_date: mockSession.reading_date },
      });
      expect(prismaMock.dailyLogbook.deleteMany).toHaveBeenCalled();
      expect(prismaMock.readingSession.delete).toHaveBeenCalledWith({ where: { session_id: 100 } });
    });

    it('Harus melempar Error400 jika bukan sesi terakhir', async () => {
      prismaMock.readingSession.findUniqueOrThrow.mockResolvedValue(mockSession as any);
      prismaMock.readingSession.findFirst.mockResolvedValue({
        ...mockSession,
        session_id: 999,
      } as any);

      await expect(readingService.delete(100)).rejects.toThrow(Error400);
    });
  });

  describe('method: findAll()', () => {
    it('Harus construct where clause dengan benar', async () => {
      prismaMock.readingSession.findMany.mockResolvedValue([]);

      const args = {
        meterId: 1,
        date: '2024-01-01',
        energyTypeName: 'Electricity',
      };

      await readingService.findAll(args as any);

      expect(prismaMock.readingSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            meter_id: 1,
            meter: { energy_type: { type_name: 'Electricity' } },
          }),
        }),
      );
    });
  });

  describe('method: findLastReading()', () => {
    it('Harus mengambil readingDetail terakhir', async () => {
      const mockDetail = { value: 100 };
      prismaMock.readingDetail.findFirst.mockResolvedValue(mockDetail as any);

      const result = await readingService.findLastReading({
        meterId: 1,
        readingTypeId: 2,
        readingDate: new Date(), // Dummy date
      });

      expect(prismaMock.readingDetail.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reading_type_id: 2,
            session: { meter_id: 1 },
          }),
          orderBy: { session: { reading_date: 'desc' } },
        }),
      );
      expect(result).toEqual(mockDetail);
    });
  });

  describe('method: getHistory()', () => {
    it('Harus menggabungkan data Session dengan PaxData', async () => {
      // Mock Reading Sessions
      const sessions = [
        { ...mockSession, reading_date: new Date('2024-01-01') },
        { ...mockSession, reading_date: new Date('2024-01-02') },
      ];
      prismaMock.readingSession.findMany.mockResolvedValue(sessions as any);

      // Mock Pax Data
      const paxData = [{ data_date: new Date('2024-01-01'), total_pax: 500, pax_id: 1 }];
      prismaMock.paxData.findMany.mockResolvedValue(paxData as any);

      // Execute with Pagination Args
      const result = await readingService.getHistory({
        meterId: 1,
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      });

      // Assertions
      expect(result.data).toHaveLength(2);
      expect(result.data[0].paxData.pax).toBe(500);
      expect(result.data[1].paxData.pax).toBeNull();
    });
  });
});
