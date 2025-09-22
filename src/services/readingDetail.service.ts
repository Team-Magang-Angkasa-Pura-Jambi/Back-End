import prisma from '../configs/db.js';
import type {
  CreateReadingDetailInput,
  ReadingDetailParams,
  UpdateReadingDetailInput,
} from '../types/readingDetail.type.js';
import { BaseService } from '../utils/baseService.js';

export class ReadingDetailService extends BaseService {
  /**
   * Mengambil semua data reading detail beserta sesi terkait.
   * @returns {Promise<ReadingDetail[]>}
   */
  public async findAll() {
    return this._handleCrudOperation(
      () =>
        prisma.readingDetail.findMany({
          include: {
            session: true,
            reading_type: true,
          },
        }),
      {}
    );
  }

  /**
   * Mencari satu data reading detail berdasarkan ID uniknya.
   * @param {ReadingDetailParams} params - Objek yang berisi detail_id.
   * @returns {Promise<ReadingDetail | null>}
   */
  public async findById(detail_id: number) {
    return this._handleCrudOperation(
      () =>
        prisma.readingDetail.findUnique({
          where: { detail_id },
        }),
      { P2025: `Data dengan ID ${detail_id} tidak ditemukan.` }
    );
  }

  /**
   * Membuat data reading detail baru.
   * @param {CreateReadingDetailInput} data - Data yang akan dibuat.
   * @returns {Promise<ReadingDetail>}
   */
  public async create(data: CreateReadingDetailInput) {
    return this._handleCrudOperation(() =>
      prisma.readingDetail.create({ data })
    );
  }

  /**
   * Memperbarui data reading detail berdasarkan ID.
   * @param {ReadingDetailParams} params - Objek yang berisi detail_id.
   * @param {UpdateReadingDetailInput} data - Data yang akan diperbarui.
   * @returns {Promise<ReadingDetail>}
   */
  public async update(detail_id: number, data: UpdateReadingDetailInput) {
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(cleanData).length === 0) {
      return this.findById(detail_id);
    }

    return this._handleCrudOperation(() =>
      prisma.readingDetail.update({
        where: { detail_id },

        data: cleanData,
      })
    );
  }

  /**
   * Menghapus data reading detail berdasarkan ID.
   * @param {ReadingDetailParams} params - Objek yang berisi detail_id.
   * @returns {Promise<ReadingDetail>}
   */
  public async delete(detail_id: number) {
    return this._handleCrudOperation(() =>
      prisma.readingDetail.delete({ where: { detail_id } })
    );
  }
}
