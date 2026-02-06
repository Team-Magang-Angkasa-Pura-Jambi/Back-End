import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type DeepMockProxy } from 'vitest-mock-extended';
import { type PrismaClient } from '@prisma/client';

vi.mock('../../../configs/db.js', async () => {
  const actualLib = await import('vitest-mock-extended');
  return {
    __esModule: true,
    default: actualLib.mockDeep<PrismaClient>(),
  };
});

import { AnnualBudgetService } from '../annualBudget.service.js';
import prisma from '../../../configs/db.js';
import { Error400 } from '../../../utils/customError.js';
import { Prisma } from '../../../generated/prisma/index.js';

describe('AnnualBudgetService Test Suite', () => {
  let annualBudgetService: AnnualBudgetService;

  const prismaMock = vi.mocked(prisma, true) as unknown as DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    vi.resetAllMocks();

    prismaMock.$transaction = vi.fn().mockImplementation(async (arg) => {
      if (typeof arg === 'function') {
        return await arg(prismaMock);
      }
      return await arg;
    }) as any;

    prismaMock.$queryRaw = vi.fn();
    prismaMock.dailySummary.groupBy = vi.fn();
    prismaMock.dailySummary.aggregate = vi.fn();

    prismaMock.annualBudget.findMany = vi.fn();
    prismaMock.annualBudget.findUnique = vi.fn();
    prismaMock.annualBudget.findUniqueOrThrow = vi.fn();
    prismaMock.annualBudget.findFirst = vi.fn();
    prismaMock.annualBudget.create = vi.fn();
    prismaMock.annualBudget.update = vi.fn();

    prismaMock.budgetAllocation.deleteMany = vi.fn();

    annualBudgetService = new AnnualBudgetService();
  });

  const mockDateStart = new Date('2024-01-01T00:00:00Z');
  const mockDateEnd = new Date('2024-12-31T23:59:59Z');

  const mockBudget = {
    budget_id: 1,
    total_budget: new Prisma.Decimal(12000000),
    period_start: mockDateStart,
    period_end: mockDateEnd,
    parent_budget_id: null,
    allocations: [],
    child_budgets: [],
  };

  describe('method: getAvailableYears()', () => {
    it('Harus mengembalikan tahun dari DB + tahun ini + tahun depan (sorted desc)', async () => {
      prismaMock.annualBudget.findMany.mockResolvedValue([
        { period_start: new Date('2022-01-01') },
      ] as any);

      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;

      const result = await annualBudgetService.getAvailableYears();

      expect(result.availableYears).toContain(2022);
      expect(result.availableYears).toContain(currentYear);
      expect(result.availableYears).toContain(nextYear);
      expect(result.availableYears[0]).toBeGreaterThanOrEqual(result.availableYears[1]);
    });
  });

  describe('method: create()', () => {
    const createBody = {
      total_budget: 1000,
      period_start: '2024-01-01',
      period_end: '2024-12-31',
      energy_type_id: 1,
      allocations: [{ meter_id: 10, weight: 1 }],
    } as any;

    it('Harus sukses membuat budget baru dengan allocations', async () => {
      prismaMock.annualBudget.create.mockResolvedValue(mockBudget as any);
      prismaMock.annualBudget.findUnique.mockResolvedValue({ parent_budget_id: null } as any);
      prismaMock.annualBudget.findFirst.mockResolvedValue(null);

      await annualBudgetService.create(createBody);

      expect(prismaMock.annualBudget.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            total_budget: 1000,
            allocations: {
              createMany: {
                data: [{ meter_id: 10, weight: 1 }],
              },
            },
          }),
        }),
      );
    });

    it('Harus melempar Error400 jika parent_budget_id tidak valid (Nesting level max)', async () => {
      prismaMock.annualBudget.findUnique.mockResolvedValue({
        budget_id: 2,
        parent_budget_id: 1,
      } as any);

      await expect(
        annualBudgetService.create({ ...createBody, parent_budget_id: 2 }),
      ).rejects.toThrow(Error400);
    });

    it('Harus melempar Error400 jika periode overlap dengan sibling budget', async () => {
      prismaMock.annualBudget.findUnique.mockResolvedValue({
        budget_id: 2,
        parent_budget_id: null,
      } as any);
      prismaMock.annualBudget.findFirst.mockResolvedValue({ budget_id: 3 } as any);

      await expect(
        annualBudgetService.create({ ...createBody, parent_budget_id: 2 }),
      ).rejects.toThrow('Periode anggaran bertabrakan');
    });
  });

  describe('method: update()', () => {
    it('Harus melakukan update dalam transaksi: hapus alokasi lama -> update budget -> buat alokasi baru', async () => {
      const updateBody = {
        total_budget: 5000,
        allocations: [{ meter_id: 20, weight: 1 }],
      };

      prismaMock.annualBudget.update.mockResolvedValue({
        ...mockBudget,
        total_budget: new Prisma.Decimal(5000),
      } as any);

      await annualBudgetService.update(1, updateBody as any);

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.budgetAllocation.deleteMany).toHaveBeenCalledWith({
        where: { budget_id: 1 },
      });
      expect(prismaMock.annualBudget.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { budget_id: 1 },
          data: expect.objectContaining({
            total_budget: 5000,
            allocations: { createMany: { data: updateBody.allocations } },
          }),
        }),
      );
    });
  });

  describe('method: getDetailedBudgets()', () => {
    it('Harus menghitung realisasi dan sisa anggaran dengan benar', async () => {
      const budgetItem = {
        ...mockBudget,
        total_budget: new Prisma.Decimal(1000),
        allocations: [
          {
            meter_id: 101,
            weight: 1,
            meter: { meter_code: 'M1' },
          },
        ],
      };
      prismaMock.annualBudget.findMany.mockResolvedValue([budgetItem] as any);

      prismaMock.dailySummary.groupBy.mockResolvedValue([
        {
          meter_id: 101,
          summary_date: mockDateStart,
          _sum: { total_cost: new Prisma.Decimal(200) },
        },
      ] as any);

      const result = await annualBudgetService.getDetailedBudgets({});

      expect(result).toHaveLength(1);
      const res = result[0];
      expect(res.totalBudget).toBe(1000);
      expect(res.totalRealization).toBe(200);
      expect(res.remainingBudget).toBe(800);
    });
  });

  describe('method: getDetailedBudgetById()', () => {
    it('Scenario CHILD Budget: Harus menghitung interpolasi bulanan', async () => {
      const childBudget = {
        ...mockBudget,
        parent_budget_id: 99,
        total_budget: new Prisma.Decimal(12000000),
        allocations: [{ meter_id: 101, weight: 1 }],
      };
      prismaMock.annualBudget.findUniqueOrThrow.mockResolvedValue(childBudget as any);
      prismaMock.$queryRaw.mockResolvedValue([{ month: 1, total_cost: 500000 }] as any);
      prismaMock.dailySummary.groupBy.mockResolvedValue([
        { meter_id: 101, _sum: { total_cost: new Prisma.Decimal(500000) } },
      ] as any);

      const result = await annualBudgetService.getDetailedBudgetById(1);

      expect(result.monthlyAllocation).toHaveLength(12);
      const jan = result.monthlyAllocation.find((m) => m.month === 1);
      expect(jan?.realizationCost).toBe(500000);
    });

    it('Scenario PARENT Budget: Harus agregasi realisasi dari child budgets', async () => {
      const parentBudget = {
        ...mockBudget,
        budget_id: 10,
        parent_budget_id: null,
        total_budget: new Prisma.Decimal(20000000),
        allocations: [],
        child_budgets: [
          {
            budget_id: 11,
            period_start: mockDateStart,
            period_end: mockDateEnd,
            allocations: [{ meter_id: 101 }],
          },
          {
            budget_id: 12,
            period_start: mockDateStart,
            period_end: mockDateEnd,
            allocations: [{ meter_id: 102 }],
          },
        ],
      };
      prismaMock.annualBudget.findUniqueOrThrow.mockResolvedValue(parentBudget as any);

      prismaMock.dailySummary.aggregate
        .mockResolvedValueOnce({ _sum: { total_cost: new Prisma.Decimal(1000000) } } as any)
        .mockResolvedValueOnce({ _sum: { total_cost: new Prisma.Decimal(2000000) } } as any);

      prismaMock.dailySummary.groupBy.mockResolvedValue([]);

      const result = await annualBudgetService.getDetailedBudgetById(10);

      expect(result.parentRealization?.totalRealization).toBe(3000000);
      expect(result.parentRealization?.realizationPercentage).toBe(15.0);
    });
  });

  describe('method: getParentBudgets()', () => {
    it('Harus mengembalikan list parent budget dengan ringkasan realisasi anak', async () => {
      const parentList = [
        {
          budget_id: 1,
          total_budget: new Prisma.Decimal(1000),
          parent_budget_id: null,
          child_budgets: [
            {
              period_start: mockDateStart,
              period_end: mockDateEnd,
              allocations: [{ meter_id: 50 }],
            },
          ],
        },
      ];

      prismaMock.annualBudget.findMany.mockResolvedValue(parentList as any);

      prismaMock.dailySummary.aggregate.mockResolvedValue({
        _sum: { total_cost: new Prisma.Decimal(300) },
      } as any);

      const result = await annualBudgetService.getParentBudgets({});

      expect(result).toHaveLength(1);
      expect(result[0].parentRealization.totalRealization).toBe(300);
    });
  });
});
