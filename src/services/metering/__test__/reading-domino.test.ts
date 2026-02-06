import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type DeepMockProxy } from 'vitest-mock-extended';
import { type PrismaClient } from '@prisma/client';

vi.mock('../../configs/db.js', async () => {
  const actualLib = await import('vitest-mock-extended');
  return {
    __esModule: true,
    default: actualLib.mockDeep<PrismaClient>(),
  };
});

vi.mock('../helpers/reading-validator.js', () => ({
  _validateMeter: vi.fn(),
  _normalizeDate: vi.fn((d) => new Date(d)),
  _validateDuplicateSession: vi.fn(),
  _validateReadingsAgainstPrevious: vi.fn(),
  _checkAndResolveMissingDataAlert: vi.fn(),
  _checkUsageAgainstTargetAndNotify: vi.fn(),
}));

vi.mock('../helpers/reading-summarizer.js', () => ({
  _findOrCreateSession: vi.fn(),
  _createReadingDetails: vi.fn(),
  _updateDailySummary: vi.fn(),
  _buildWhereClause: vi.fn(() => ({})),
  _buildOrderByClause: vi.fn(() => ({})),
}));

vi.mock('../../intelligence/predict.service.js', () => ({
  predictTerminal: vi.fn(),
  predictOffice: vi.fn(),
}));

vi.mock('../../intelligence/classify.service.js', () => ({
  classifyOffice: vi.fn(),
  classifyTerminal: vi.fn(),
}));

vi.mock('../../operations/dailyLogbook.service.js', () => ({
  dailyLogbookService: {
    generateDailyLog: vi.fn(),
  },
}));

import { ReadingService } from '../reading.service.js';
import * as validator from '../helpers/reading-validator.js';
import * as summarizer from '../helpers/reading-summarizer.js';
import * as predictor from '../../intelligence/predict.service.js';
import * as classifier from '../../intelligence/classify.service.js';
import { dailyLogbookService } from '../../operations/dailyLogbook.service.js';
import prisma from '../../../configs/db.js';

describe('ReadingService DOMINO SCENARIO (Create -> Update -> Delete)', () => {
  let readingService: ReadingService;
  const prismaMock = vi.mocked(prisma, true) as unknown as DeepMockProxy<PrismaClient>;

  const DOMINO_ID = 777;
  const METER_ID = 1;
  const DATE_STR = '2024-05-20';
  const DATE_OBJ = new Date('2024-05-20T00:00:00.000Z');

  const mockMeter = {
    meter_id: METER_ID,
    meter_code: 'DOMINO-01',
    category: { name: 'Terminal' },
    energy_type: { type_name: 'Electricity' },
  };

  const mockSession = {
    session_id: DOMINO_ID,
    meter_id: METER_ID,
    reading_date: DATE_OBJ,
    meter: mockMeter,
    details: [],
    user: { username: 'tester' },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.meter.findUniqueOrThrow = vi.fn();
    prismaMock.readingSession.create = vi.fn();
    prismaMock.readingSession.update = vi.fn();

    prismaMock.$transaction = vi.fn().mockImplementation(async (arg) => {
      if (typeof arg === 'function') return arg(prismaMock);
      return arg;
    }) as any;

    vi.mocked(validator._validateMeter).mockResolvedValue(mockMeter as any);
    vi.mocked(summarizer._findOrCreateSession).mockResolvedValue({ sessionId: DOMINO_ID } as any);
    vi.mocked(summarizer._updateDailySummary).mockResolvedValue([
      { summary_date: DATE_OBJ } as any,
    ]);

    vi.mocked(predictor.predictTerminal).mockResolvedValue(null);
    vi.mocked(classifier.classifyTerminal).mockResolvedValue();

    prismaMock.readingSession.findUniqueOrThrow = vi.fn();
    prismaMock.readingSession.findFirst = vi.fn();
    prismaMock.readingSession.delete = vi.fn();
    prismaMock.readingDetail.deleteMany = vi.fn();
    prismaMock.dailySummary.deleteMany = vi.fn();
    prismaMock.dailyLogbook.deleteMany = vi.fn();

    readingService = new ReadingService();
  });

  it('Step 1 (CREATE): User memasukkan data pembacaan baru', async () => {
    prismaMock.readingSession.findUniqueOrThrow.mockResolvedValue(mockSession as any);

    const createData = {
      meter_id: METER_ID,
      reading_date: DATE_STR,
      details: [{ reading_type_id: 1, value: 100 }],
      user_id: 99,
    };

    const result = await readingService.create(createData as any);

    expect(result.session_id).toBe(DOMINO_ID);

    expect(validator._validateDuplicateSession).toHaveBeenCalled();
    expect(summarizer._updateDailySummary).toHaveBeenCalled();
    expect(predictor.predictTerminal).toHaveBeenCalled();
    console.log('✅ Domino 1: Create Success');
  });

  it('Step 1.5 (FAIL): User mencoba input angka LEBIH KECIL dari sebelumnya (Harus Gagal)', async () => {
    const invalidData = {
      meter_id: METER_ID,
      reading_date: DATE_STR,
      details: [{ reading_type_id: 1, value: 50 }],
      user_id: 99,
    };

    vi.mocked(validator._validateReadingsAgainstPrevious).mockRejectedValueOnce(
      new Error('Nilai pembacaan tidak boleh lebih kecil dari pembacaan sebelumnya (Last: 80)'),
    );

    await expect(readingService.create(invalidData as any)).rejects.toThrow(
      'Nilai pembacaan tidak boleh lebih kecil',
    );

    expect(prismaMock.readingSession.create).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();

    expect(predictor.predictTerminal).not.toHaveBeenCalled();

    console.log('✅ Domino 1.5: Validation Guard Success');
  });

  it('Step 2 (UPDATE): User merevisi nilai karena salah input', async () => {
    prismaMock.readingSession.findUniqueOrThrow.mockResolvedValue(mockSession as any);
    prismaMock.readingSession.findFirst.mockResolvedValue(mockSession as any);

    prismaMock.meter.findUniqueOrThrow.mockResolvedValue(mockMeter as any);

    const updateData = {
      details: [{ reading_type_id: 1, value: 150 }],
    };

    const result = await readingService.update(DOMINO_ID, updateData as any);

    expect(prismaMock.readingDetail.deleteMany).toHaveBeenCalledWith({
      where: { session_id: DOMINO_ID },
    });

    expect(summarizer._createReadingDetails).toHaveBeenCalledWith(
      expect.anything(),
      DOMINO_ID,
      updateData.details,
    );

    expect(summarizer._updateDailySummary).toHaveBeenCalled();
    expect(classifier.classifyTerminal).toHaveBeenCalled();
    expect(dailyLogbookService.generateDailyLog).toHaveBeenCalled();

    console.log('✅ Domino 2: Update Success');
  });

  it('Step 3 (DELETE): User menghapus data tersebut', async () => {
    prismaMock.readingSession.findUniqueOrThrow.mockResolvedValue(mockSession as any);
    prismaMock.readingSession.findFirst.mockResolvedValue(mockSession as any);

    prismaMock.readingSession.delete.mockResolvedValue(mockSession as any);

    await readingService.delete(DOMINO_ID);

    expect(prismaMock.dailySummary.deleteMany).toHaveBeenCalledWith({
      where: { meter_id: METER_ID, summary_date: mockSession.reading_date },
    });

    expect(prismaMock.dailyLogbook.deleteMany).toHaveBeenCalledWith({
      where: { meter_id: METER_ID, log_date: mockSession.reading_date },
    });

    expect(prismaMock.readingSession.delete).toHaveBeenCalledWith({
      where: { session_id: DOMINO_ID },
    });

    console.log('✅ Domino 3: Delete Success - Lifecycle Complete');
  });
});
