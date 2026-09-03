import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateDailyCost } from './daily_summaries.service.js';

describe('dailySummaryService - calculateDailyCost', () => {
  let mockTx: any;

  beforeEach(() => {
    mockTx = {
      meter: {
        findUnique: vi.fn(),
      },
      readingSession: {
        findFirst: vi.fn(),
      },
    };
  });

  it('should calculate daily cost correctly according to the provided image master data', async () => {
    const meterId = 1;
    const targetDate = new Date('2026-08-27T10:00:00Z');

    // 1. Setup Mock for Meter with multiplier = 2000 and Scheme Rates
    mockTx.meter.findUnique.mockResolvedValue({
      meter_id: meterId,
      multiplier: 2000,
      price_scheme: {
        name: 'Tarif Listrik',
        is_active: true,
        effective_date: new Date('2020-01-01T00:00:00Z'),
        rates: [
          {
            rate_value: 1035.78,
            reading_type: { type_name: 'LWBP' },
          },
          {
            rate_value: 1553.67,
            reading_type: { type_name: 'WBP' },
          },
        ],
      },
    });

    // 2. Setup Mock for ReadingSessions (Current & Previous)
    mockTx.readingSession.findFirst.mockImplementation((args: any) => {
      // If it's searching for the current day session
      if (args.where.reading_date.gte) {
        return {
          meter_id: meterId,
          reading_date: targetDate,
          details: [
            {
              reading_type_id: 1,
              value: 8339.4,
              reading_type: { type_name: 'LWBP' },
            },
            {
              reading_type_id: 2,
              value: 1317.84,
              reading_type: { type_name: 'WBP' },
            },
          ],
        };
      }
      // If it's searching for the previous day session
      if (args.where.reading_date.lt) {
        return {
          meter_id: meterId,
          reading_date: new Date('2026-08-26T10:00:00Z'),
          details: [
            {
              reading_type_id: 1,
              value: 8335.08,
              reading_type: { type_name: 'LWBP' },
            },
            {
              reading_type_id: 2,
              value: 1317.36,
              reading_type: { type_name: 'WBP' },
            },
          ],
        };
      }
      return null;
    });

    const result = await calculateDailyCost(meterId, targetDate, mockTx);

    // Assert Total Cost matches 10,440,662.40
    expect(result.total_cost).toBeCloseTo(10440662.4, 2);

    // Assert Breakdown
    const lwbpBreakdown = result.breakdown.find((b: any) => b.category === 'LWBP');
    const wbpBreakdown = result.breakdown.find((b: any) => b.category === 'WBP');

    expect(lwbpBreakdown).toBeDefined();
    // 8339.400 - 8335.080 = 4.320 => 4.320 * 2000 = 8640
    expect(lwbpBreakdown.consumption_value).toBeCloseTo(8640, 2);
    // 8640 * 1035.78 = 8,949,139.20
    expect(lwbpBreakdown.cost).toBeCloseTo(8949139.2, 2);

    expect(wbpBreakdown).toBeDefined();
    // 1317.840 - 1317.360 = 0.480 => 0.480 * 2000 = 960
    expect(wbpBreakdown.consumption_value).toBeCloseTo(960, 2);
    // 960 * 1553.67 = 1,491,523.20
    expect(wbpBreakdown.cost).toBeCloseTo(1491523.2, 2);
  });

  it('should calculate daily cost correctly according to Perhitungan Listrik Perkantoran 20 Agustus 2026', async () => {
    const meterId = 2;
    const targetDate = new Date('2026-08-20T10:00:00Z');

    // 1. Setup Mock for Meter with multiplier = 120 and Scheme Rates
    mockTx.meter.findUnique.mockResolvedValue({
      meter_id: meterId,
      multiplier: 120,
      price_scheme: {
        name: 'Tarif Listrik',
        is_active: true,
        effective_date: new Date('2020-01-01T00:00:00Z'),
        rates: [
          {
            rate_value: 1090.78,
            reading_type: { type_name: 'LWBP' },
          },
          {
            rate_value: 1608.67,
            reading_type: { type_name: 'WBP' },
          },
        ],
      },
    });

    // 2. Setup Mock for ReadingSessions
    mockTx.readingSession.findFirst.mockImplementation((args: any) => {
      // Current day session
      if (args.where.reading_date.gte) {
        return {
          meter_id: meterId,
          reading_date: targetDate,
          details: [
            {
              reading_type_id: 1,
              value: 7.10, // 6.70 (Periode 1) + 0.40 (Periode 3)
              reading_type: { type_name: 'LWBP' },
            },
            {
              reading_type_id: 2,
              value: 1.40, // 1.40 (Periode 2)
              reading_type: { type_name: 'WBP' },
            },
          ],
        };
      }
      // Previous day session
      if (args.where.reading_date.lt) {
        return {
          meter_id: meterId,
          reading_date: new Date('2026-08-19T10:00:00Z'),
          details: [
            {
              reading_type_id: 1,
              value: 0,
              reading_type: { type_name: 'LWBP' },
            },
            {
              reading_type_id: 2,
              value: 0,
              reading_type: { type_name: 'WBP' },
            },
          ],
        };
      }
      return null;
    });

    const result = await calculateDailyCost(meterId, targetDate, mockTx);

    // Total Cost matches 1,199,601.12
    expect(result.total_cost).toBeCloseTo(1199601.12, 2);

    // Assert Breakdown
    const lwbpBreakdown = result.breakdown.find((b: any) => b.category === 'LWBP');
    const wbpBreakdown = result.breakdown.find((b: any) => b.category === 'WBP');

    expect(lwbpBreakdown).toBeDefined();
    // 7.10 * 120 = 852
    expect(lwbpBreakdown.consumption_value).toBeCloseTo(852, 2);
    // 852 * 1090.78 = 929,344.56  (876,987.12 + 52,357.44)
    expect(lwbpBreakdown.cost).toBeCloseTo(929344.56, 2);

    expect(wbpBreakdown).toBeDefined();
    // 1.40 * 120 = 168
    expect(wbpBreakdown.consumption_value).toBeCloseTo(168, 2);
    // 168 * 1608.67 = 270,256.56
    expect(wbpBreakdown.cost).toBeCloseTo(270256.56, 2);
  });
});
