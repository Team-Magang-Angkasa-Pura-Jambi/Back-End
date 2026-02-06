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
import { MeterService } from '../meter.service.js';
import { Error400, Error404 } from '../../../utils/customError.js';
import prisma from '../../../configs/db.js';
import { Prisma } from '../../../generated/prisma/index.js';

describe('MeterService Test Suite', () => {
  let meterService: MeterService;
  const prismaMock = vi.mocked(prisma, true) as unknown as DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    vi.resetAllMocks();

    // Define Spies
    prismaMock.meter.findMany = vi.fn();
    prismaMock.meter.findUnique = vi.fn();
    prismaMock.meter.findUniqueOrThrow = vi.fn();
    prismaMock.meter.create = vi.fn();
    prismaMock.meter.update = vi.fn();
    prismaMock.meter.delete = vi.fn();

    prismaMock.user.findFirst = vi.fn();
    prismaMock.energyType.findUniqueOrThrow = vi.fn();
    prismaMock.tariffGroup.findUnique = vi.fn();
    prismaMock.readingSession.findFirst = vi.fn();

    meterService = new MeterService();
  });

  // --- DUMMY DATA ---
  const mockUser = { user_id: 1, role: { role_name: 'Staff' } };
  const mockSuperAdmin = { user_id: 99, role: { role_name: 'SuperAdmin' } };

  const mockEnergyElectricity = { energy_type_id: 1, type_name: 'Electricity' };
  const mockEnergyFuel = { energy_type_id: 2, type_name: 'Fuel' };
  const mockEnergyWater = { energy_type_id: 3, type_name: 'Water' };

  const mockTariffValidElec = {
    tariff_group_id: 10,
    group_code: 'TR-ELEC',
    price_schemes: [
      {
        rates: [{ reading_type: { type_name: 'WBP' } }, { reading_type: { type_name: 'LWBP' } }],
      },
    ],
  };

  const mockTariffInvalidElec = {
    tariff_group_id: 11,
    group_code: 'TR-INVALID',
    price_schemes: [
      {
        rates: [
          { reading_type: { type_name: 'Flat' } }, // Missing WBP/LWBP
        ],
      },
    ],
  };

  const mockMeter = {
    meter_id: 100,
    meter_code: 'M-100',
    energy_type_id: 1,
    energy_type: mockEnergyElectricity,
    status: 'Active',
  };

  describe('method: findAllwithRole()', () => {
    it('Positive: SuperAdmin harus melihat semua data (termasuk Deleted)', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockSuperAdmin as any);
      prismaMock.meter.findMany.mockResolvedValue([mockMeter] as any);

      await meterService.findAllwithRole(99, {});

      // Cek bahwa where clause TIDAK mengandung filter status != Deleted
      expect(prismaMock.meter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ status: { not: 'Deleted' } }),
        }),
      );
    });

    it('Positive: User biasa HANYA melihat data yang tidak Deleted', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser as any);
      prismaMock.meter.findMany.mockResolvedValue([mockMeter] as any);

      await meterService.findAllwithRole(1, {});

      expect(prismaMock.meter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { not: 'Deleted' } }),
        }),
      );
    });

    it('Negative: Harus melempar Error404 jika user tidak ditemukan', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      await expect(meterService.findAllwithRole(999)).rejects.toThrow(Error404);
    });
  });

  describe('method: create()', () => {
    const baseBody = {
      meter_code: 'NEW-001',
      energy_type_id: 1,
      category_id: 1,
      tariff_group_id: 10,
      status: 'Active',
    };

    it('Positive: Sukses membuat meter Listrik dengan konfigurasi tarif valid', async () => {
      prismaMock.energyType.findUniqueOrThrow.mockResolvedValue(mockEnergyElectricity as any);
      prismaMock.tariffGroup.findUnique.mockResolvedValue(mockTariffValidElec as any);
      prismaMock.meter.create.mockResolvedValue(mockMeter as any);

      await meterService.create(baseBody as any);

      expect(prismaMock.meter.create).toHaveBeenCalled();
    });

    it('Positive: Sukses membuat meter Fuel dengan data tangki', async () => {
      const fuelBody = {
        ...baseBody,
        energy_type_id: 2,
        tank_height_cm: 100,
        tank_volume_liters: 5000,
      };
      prismaMock.energyType.findUniqueOrThrow.mockResolvedValue(mockEnergyFuel as any);
      prismaMock.tariffGroup.findUnique.mockResolvedValue({
        ...mockTariffValidElec,
        price_schemes: [{ rates: [] }],
      } as any); // Tarif fuel bebas
      prismaMock.meter.create.mockResolvedValue(mockMeter as any);

      await meterService.create(fuelBody as any);

      expect(prismaMock.meter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tank_height_cm: 100,
            tank_volume_liters: 5000,
          }),
        }),
      );
    });

    it('Negative: Gagal membuat meter Listrik jika tarif tidak punya WBP/LWBP', async () => {
      prismaMock.energyType.findUniqueOrThrow.mockResolvedValue(mockEnergyElectricity as any);
      prismaMock.tariffGroup.findUnique.mockResolvedValue(mockTariffInvalidElec as any);

      await expect(meterService.create(baseBody as any)).rejects.toThrow(
        'wajib memiliki tarif untuk WBP dan LWBP',
      );
    });

    it('Negative: Gagal membuat meter Fuel jika data tangki kosong', async () => {
      const invalidFuelBody = { ...baseBody, energy_type_id: 2 }; // Missing tank info
      prismaMock.energyType.findUniqueOrThrow.mockResolvedValue(mockEnergyFuel as any);
      prismaMock.tariffGroup.findUnique.mockResolvedValue({
        ...mockTariffValidElec,
        price_schemes: [{ rates: [] }],
      } as any);

      await expect(meterService.create(invalidFuelBody as any)).rejects.toThrow('wajib diisi');
    });

    it('Negative: Gagal jika Tariff Group tidak ditemukan', async () => {
      prismaMock.energyType.findUniqueOrThrow.mockResolvedValue(mockEnergyElectricity as any);
      prismaMock.tariffGroup.findUnique.mockResolvedValue(null);

      await expect(meterService.create(baseBody as any)).rejects.toThrow(Error400);
    });
  });

  describe('method: update()', () => {
    it('Positive: Update Fuel Meter (Validasi Tank Info)', async () => {
      // Mock Current: Fuel Meter
      prismaMock.meter.findUniqueOrThrow.mockResolvedValue({
        ...mockMeter,
        energy_type_id: 2,
        energy_type: mockEnergyFuel,
        tank_height_cm: new Prisma.Decimal(100),
        tank_volume_liters: new Prisma.Decimal(5000),
      } as any);

      prismaMock.meter.update.mockResolvedValue(mockMeter as any);

      // Update hanya volume
      await meterService.update(100, { tank_volume_liters: 6000 } as any);

      expect(prismaMock.meter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tank_height_cm: 100, // Mengambil dari existing (Decimal -> Number handling)
            tank_volume_liters: 6000, // Nilai baru
          }),
        }),
      );
    });

    it('Negative: Update ganti Tariff Group invalid (Listrik)', async () => {
      prismaMock.meter.findUniqueOrThrow.mockResolvedValue(mockMeter as any); // Current is Elec
      // Target Tariff Group Invalid
      prismaMock.tariffGroup.findUnique.mockResolvedValue(mockTariffInvalidElec as any);

      await expect(meterService.update(100, { tariff_group_id: 11 } as any)).rejects.toThrow(
        'wajib memiliki tarif untuk WBP dan LWBP',
      );
    });
  });

  describe('method: delete()', () => {
    it('Positive: HARD DELETE jika tidak ada data pembacaan (child)', async () => {
      prismaMock.readingSession.findFirst.mockResolvedValue(null); // Tidak ada child
      prismaMock.meter.delete.mockResolvedValue(mockMeter as any);

      await meterService.delete(100);

      expect(prismaMock.meter.delete).toHaveBeenCalledWith({ where: { meter_id: 100 } });
      expect(prismaMock.meter.update).not.toHaveBeenCalled();
    });

    it('Positive: SOFT DELETE jika ada data pembacaan (child)', async () => {
      prismaMock.readingSession.findFirst.mockResolvedValue({ session_id: 1 } as any); // Ada child
      prismaMock.meter.update.mockResolvedValue(mockMeter as any);

      await meterService.delete(100);

      expect(prismaMock.meter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { meter_id: 100 },
          data: { status: 'Deleted' },
        }),
      );
      expect(prismaMock.meter.delete).not.toHaveBeenCalled();
    });
  });
});
