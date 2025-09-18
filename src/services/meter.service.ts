import prisma from '../configs/db.js';
import type { CreateMeterBody, UpdateMeterBody } from '../types/meter.tpye.js';
import { Error409 } from '../utils/customError.js';

/**
 * Service yang menangani semua logika bisnis terkait data meteran.
 */
export class MeterService {
  public async findAll() {
    return prisma.meter.findMany({
      include: {
        energy_type: true, // Sertakan detail jenis energi
      },
      orderBy: {
        meter_id: 'asc',
      },
    });
  }

  public async findAllActive() {
    return prisma.meter.findMany({
      where: {
        status: 'Active',
      },
      include: {
        energy_type: true, // Sertakan detail jenis energi
      },
      orderBy: {
        meter_id: 'asc',
      },
    });
  }

  /**
   * Menemukan satu meteran berdasarkan ID-nya.
   */
  public async findById(meterId: number) {
    return prisma.meter.findUnique({
      where: {
        meter_id: meterId,
      },
      include: {
        energy_type: true,
      },
    });
  }

  /**
   * Membuat meteran baru.
   */
  public async create(data: CreateMeterBody) {
    // Cek apakah meter_code sudah ada untuk mencegah duplikasi
    const existingMeter = await prisma.meter.findUnique({
      where: { meter_code: data.meter_code },
    });
    if (existingMeter) {
      throw new Error409(`Meteran dengan kode ${data.meter_code} sudah ada.`);
    }

    return prisma.meter.create({
      data,
    });
  }

  /**
   * Memperbarui data meteran yang ada.
   */
  public async update(meterId: number, data: UpdateMeterBody) {
    // Jika meter_code diubah, cek duplikasi
    if (data.meter_code) {
      const existingMeter = await prisma.meter.findFirst({
        where: {
          meter_code: data.meter_code,
          NOT: {
            meter_id: meterId,
          },
        },
      });
      if (existingMeter) {
        throw new Error409(
          `Meteran dengan kode ${data.meter_code} sudah digunakan.`
        );
      }
    }

    return prisma.meter.update({
      where: {
        meter_id: meterId,
      },
      data,
    });
  }

  /**
   * Menghapus meteran.
   */
  public async delete(meter_id: number) {
    // PERHATIAN: Pastikan tidak ada data 'ReadingSession' yang terkait sebelum menghapus
    // Logika ini bisa ditambahkan di sini jika diperlukan.
    return prisma.meter.update({
      where: {
        meter_id,
      },
      data: {
        status: 'DELETED',
      },
    });
  }
}

export const meterService = new MeterService();
