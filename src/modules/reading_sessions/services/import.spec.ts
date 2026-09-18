import { describe, it, expect, vi } from 'vitest';
import { templateGeneratorService } from './template_generator.service.js';
import prisma from '../../../configs/db.js';

vi.mock('../../../configs/db.js', () => ({
  default: {
    energyType: {
      findUnique: vi.fn(),
    },
    meter: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('templateGeneratorService', () => {
  it('should throw Error404 when energy_type_id does not exist', async () => {
    vi.mocked(prisma.energyType.findUnique).mockResolvedValue(null as any);

    await expect(templateGeneratorService.generateReadingTemplate(999)).rejects.toThrow(
      'Energy type dengan ID 999 tidak ditemukan.',
    );
  });

  it('should throw Error400 when energy_type has no reading types', async () => {
    vi.mocked(prisma.energyType.findUnique).mockResolvedValue({
      energy_type_id: 1,
      name: 'Electricity',
      unit_standard: 'kWh',
      reading_types: [],
      meters: [],
    } as any);

    await expect(templateGeneratorService.generateReadingTemplate(1)).rejects.toThrow(
      'Jenis energi Electricity belum memiliki Reading Type terdaftar.',
    );
  });

  it('should generate XLSX buffer for valid energy_type', async () => {
    vi.mocked(prisma.energyType.findUnique).mockResolvedValue({
      energy_type_id: 1,
      name: 'Electricity',
      unit_standard: 'kWh',
      reading_types: [
        { reading_type_id: 10, type_name: 'WBP', unit: 'kWh' },
        { reading_type_id: 11, type_name: 'LWBP', unit: 'kWh' },
      ],
      meters: [
        {
          meter_id: 101,
          meter_code: 'EL-001',
          name: 'Main Meter',
          category: 'TERMINAL',
          location: { name: 'Main Substation' },
          tenant: { name: 'PLN' },
          reading_configs: [
            {
              is_active: true,
              reading_type: { reading_type_id: 10, type_name: 'WBP', unit: 'kWh' },
            },
          ],
        },
      ],
    } as any);

    const buffer = await templateGeneratorService.generateReadingTemplate(1);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should generate XLSX buffer for specific meter_id with specific reading configs', async () => {
    vi.mocked(prisma.energyType.findUnique).mockResolvedValue({
      energy_type_id: 1,
      name: 'Electricity',
      unit_standard: 'kWh',
      reading_types: [],
      meters: [
        {
          meter_id: 101,
          meter_code: 'EL-KANTOR',
          name: 'Meter Kantor',
          category: 'KANTOR',
          location: { name: 'Gedung Utama' },
          tenant: { name: 'Internal' },
          reading_configs: [
            {
              is_active: true,
              reading_type: { reading_type_id: 1, type_name: 'Pagi', unit: 'kWh' },
            },
            {
              is_active: true,
              reading_type: { reading_type_id: 2, type_name: 'Sore', unit: 'kWh' },
            },
            {
              is_active: true,
              reading_type: { reading_type_id: 3, type_name: 'Malam', unit: 'kWh' },
            },
          ],
        },
      ],
    } as any);

    const buffer = await templateGeneratorService.generateReadingTemplate(1, 101);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
