import prisma from '../configs/db.js';
import { Prisma } from '../generated/prisma/index.js';
import type {
  CreateReadingTypeInput,
  UpdateReadingTypeInput,
} from '../types/readingType.type.js';
import { Error404, Error409 } from '../utils/customError.js';

/**
 * Service yang menangani semua logika bisnis terkait Tipe Pembacaan.
 */
export class ReadingTypeService {
  /**
   * Metode privat untuk memeriksa keunikan type_name.
   */
  private async _checkTypeNameUniqueness(name: string, excludeId?: number) {
    const whereClause: Prisma.ReadingTypeWhereInput = { type_name: name };
    if (excludeId) {
      whereClause.NOT = { reading_type_id: excludeId };
    }
    const existingType = await prisma.readingType.findFirst({
      where: whereClause,
    });
    if (existingType) {
      throw new Error409(`Tipe pembacaan dengan nama '${name}' sudah ada.`);
    }
  }

  /**
   * Menemukan semua tipe pembacaan.
   */
  public async findAll() {
    return prisma.readingType.findMany({
      include: { energy_type: true },
      orderBy: { reading_type_id: 'asc' },
    });
  }

  /**
   * Menemukan satu tipe pembacaan berdasarkan ID-nya.
   */
  public async findById(readingTypeId: number) {
    const readingType = await prisma.readingType.findUnique({
      where: { reading_type_id: readingTypeId },
      include: { energy_type: true },
    });
    if (!readingType) {
      throw new Error404(
        `Tipe pembacaan dengan ID ${readingTypeId} tidak ditemukan.`
      );
    }
    return readingType;
  }

  /**
   * Membuat tipe pembacaan baru.
   */
  public async create(data: CreateReadingTypeInput) {
    await this._checkTypeNameUniqueness(data.type_name);
    return prisma.readingType.create({
      data,
    });
  }

  /**
   * Memperbarui data tipe pembacaan yang ada.
   */
  public async update(readingTypeId: number, data: UpdateReadingTypeInput) {
    await this.findById(readingTypeId);
    if (data.type_name) {
      await this._checkTypeNameUniqueness(data.type_name, readingTypeId);
    }
    return prisma.readingType.update({
      where: { reading_type_id: readingTypeId },
      data,
    });
  }

  /**
   * Menghapus tipe pembacaan.
   */
  public async delete(readingTypeId: number) {
    await this.findById(readingTypeId);
    try {
      return await prisma.readingType.delete({
        where: { reading_type_id: readingTypeId },
      });
    } catch (error) {
      // Menangani error jika tipe pembacaan masih digunakan oleh ReadingDetail
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new Error409(
          'Tidak dapat menghapus tipe pembacaan karena masih digunakan oleh data pembacaan.'
        );
      }
      throw error;
    }
  }
}
