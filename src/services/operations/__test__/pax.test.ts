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

// --- 2. IMPORT MODULES ---
import { PaxService } from '../pax.service.js'; // Sesuaikan path jika perlu
import prisma from '../../../configs/db.js';

describe('PaxService Test Suite', () => {
  let paxService: PaxService;
  const prismaMock = vi.mocked(prisma, true) as unknown as DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    vi.resetAllMocks();

    // Fix: Definisi manual Spy untuk method yang dipakai GenericBaseService
    prismaMock.paxData.findMany = vi.fn();
    prismaMock.paxData.findUnique = vi.fn();
    prismaMock.paxData.create = vi.fn();
    prismaMock.paxData.update = vi.fn();
    prismaMock.paxData.delete = vi.fn();

    paxService = new PaxService();
  });

  // --- DUMMY DATA ---
  const mockDate = new Date('2024-01-01T00:00:00Z');
  const mockPax = {
    pax_id: 1,
    total_pax: 500,
    data_date: mockDate,
    created_at: mockDate,
    updated_at: mockDate,
  };

  describe('method: create()', () => {
    it('Harus sukses membuat data Pax baru', async () => {
      const createBody = {
        total_pax: 500,
        data_date: mockDate,
      };

      prismaMock.paxData.create.mockResolvedValue(mockPax as any);

      const result = await paxService.create(createBody as any);

      expect(prismaMock.paxData.create).toHaveBeenCalledWith({
        data: createBody,
      });
      expect(result).toEqual(mockPax);
    });
  });

  describe('method: findAll()', () => {
    it('Harus mengembalikan array data Pax', async () => {
      prismaMock.paxData.findMany.mockResolvedValue([mockPax] as any);

      const result = await paxService.findAll({});

      expect(prismaMock.paxData.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].pax_id).toBe(1);
    });
  });

  describe('method: update()', () => {
    it('Harus sukses update data Pax', async () => {
      const updateBody = { total_pax: 600 };
      const updatedPax = { ...mockPax, total_pax: 600 };

      prismaMock.paxData.update.mockResolvedValue(updatedPax as any);

      const result = await paxService.update(1, updateBody as any);

      expect(prismaMock.paxData.update).toHaveBeenCalledWith({
        where: { pax_id: 1 },
        data: updateBody,
      });
      expect(result.total_pax).toBe(600);
    });
  });

  describe('method: delete()', () => {
    it('Harus sukses menghapus data Pax', async () => {
      prismaMock.paxData.delete.mockResolvedValue(mockPax as any);

      const result = await paxService.delete(1);

      expect(prismaMock.paxData.delete).toHaveBeenCalledWith({
        where: { pax_id: 1 },
      });
      expect(result).toEqual(mockPax);
    });
  });
});
