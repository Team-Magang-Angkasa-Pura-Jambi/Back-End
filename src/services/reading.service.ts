import prisma from '../configs/db.js';
import { Prisma } from '../generated/prisma/index.js';
import type {
  CreateReadingSessionBody,
  GetReadingsQuery,
} from '../types/reading.types.js';
import {
  Error400,
  Error404,
  Error409,
  Error500,
} from '../utils/customError.js';

/**
 * Service yang menangani semua logika bisnis terkait Sesi Pembacaan.
 */
export class ReadingService {
  /**
   * Menemukan semua sesi pembacaan dengan filter dinamis.
   */
  public async findAll(query: GetReadingsQuery) {
    const { energyTypeName, date, meterId, userId } = query;
    const whereClause: Prisma.ReadingSessionWhereInput = {};

    if (energyTypeName) {
      whereClause.meter = { energy_type: { type_name: energyTypeName } };
    }
    if (date) {
      const readingDate = new Date(date);
      readingDate.setUTCHours(0, 0, 0, 0);
      whereClause.reading_date = readingDate;
    }
    if (meterId) {
      whereClause.meter_id = meterId;
    }
    if (userId) {
      whereClause.user_id = userId;
    }

    return prisma.readingSession.findMany({
      where: whereClause,
      include: {
        meter: { include: { energy_type: true } },
        user: { select: { user_id: true, username: true } },
        details: { include: { reading_type: true } },
        correction_for: { include: { details: true } },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  /**
   * Menemukan satu sesi pembacaan berdasarkan ID-nya.
   */
  public async findById(sessionId: number) {
    const reading = await prisma.readingSession.findUnique({
      where: { session_id: sessionId },
      include: {
        meter: { include: { energy_type: true } },
        user: { select: { user_id: true, username: true } },
        details: { include: { reading_type: true } },
      },
    });

    if (!reading) {
      throw new Error404(
        `Sesi pembacaan dengan ID ${sessionId} tidak ditemukan.`
      );
    }
    return reading;
  }

  /**
   * Membuat sesi pembacaan baru.
   */
  public async create(data: CreateReadingSessionBody) {
    const { meter_id, user_id, timestamp, details } = data;

    // 1. Validasi proaktif: Pastikan semua reading_type_id yang diberikan valid.
    const providedTypeIds = details
      .map((d) => d.reading_type_id)
      .filter((id): id is number => id !== undefined && id !== null);

    if (providedTypeIds.length > 0) {
      const existingTypes = await prisma.readingType.findMany({
        where: { reading_type_id: { in: providedTypeIds } },
      });
      if (existingTypes.length !== providedTypeIds.length) {
        throw new Error400(
          'Satu atau lebih reading_type_id yang diberikan tidak valid.'
        );
      }
    }

    // 2. Ambil informasi meteran untuk mengetahui jenis energinya.
    const meter = await prisma.meter.findUnique({
      where: { meter_id },
      include: { energy_type: true },
    });
    if (!meter) {
      throw new Error404(`Meteran dengan ID ${meter_id} tidak ditemukan.`);
    }

    if (meter.status === 'DELETED') {
      throw new Error404(`Meteran dengan ID ${meter_id} Sudah Di Hapus`);
    }

    // 3. Logika baru untuk penentuan reading_type_id otomatis yang lebih aman
    const needsAutoAssignment = details.some((d) => d.reading_type_id == null);
    let defaultReadingTypeId: number | null = null;

    if (needsAutoAssignment) {
      // Penugasan otomatis hanya diizinkan jika ada TEPAT SATU detail.
      if (details.length > 1) {
        throw new Error400(
          'Jika ada lebih dari satu detail, reading_type_id wajib diisi untuk setiap detail.'
        );
      }

      // Tentukan nama tipe default berdasarkan jenis energi meteran
      const defaultTypeName = {
        Electricity: 'kWh_Total',
        Water: 'm3_Total',
        Fuel: 'Liter_Total',
      }[meter.energy_type.type_name];

      if (!defaultTypeName) {
        throw new Error500(
          `Jenis energi '${meter.energy_type.type_name}' tidak mendukung tipe pembacaan otomatis.`
        );
      }

      const readingType = await prisma.readingType.findUnique({
        where: { type_name: defaultTypeName },
      });

      if (!readingType) {
        throw new Error500(
          `Konfigurasi default Reading Type ('${defaultTypeName}') tidak ditemukan di database.`
        );
      }
      defaultReadingTypeId = readingType.reading_type_id;
    }

    const readingDate = new Date(timestamp);
    readingDate.setUTCHours(0, 0, 0, 0);

    try {
      return await prisma.$transaction(async (tx) => {
        const newSession = await tx.readingSession.create({
          data: { meter_id, user_id, timestamp, reading_date: readingDate },
        });

        // 4. Proses detail, gunakan ID default jika tidak ada yang disediakan.
        const detailData = details.map((detail) => {
          const readingTypeId = detail.reading_type_id ?? defaultReadingTypeId;
          // Pemeriksaan ini sekarang lebih kuat karena logika di atas memastikan defaultReadingTypeId akan diatur jika diperlukan.
          if (!readingTypeId) {
            throw new Error400('reading_type_id tidak dapat ditentukan.');
          }
          return {
            session_id: newSession.session_id,
            reading_type_id: readingTypeId,
            value: detail.value,
          };
        });

        await tx.readingDetail.createMany({ data: detailData });

        return tx.readingSession.findUnique({
          where: { session_id: newSession.session_id },
          include: { details: { include: { reading_type: true } } },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new Error409(
          'Data pembacaan untuk meteran ini pada tanggal tersebut sudah ada.'
        );
      }
      throw error;
    }
  }

  /**
   * Membuat koreksi untuk sesi pembacaan yang sudah ada.
   */
  public async createCorrection(
    originalSessionId: number,
    data: CreateReadingSessionBody
  ) {
    await this.findById(originalSessionId);

    const { meter_id, user_id, timestamp, details } = data;

    const readingDate = new Date(timestamp);
    readingDate.setUTCHours(0, 0, 0, 0);

    return prisma.$transaction(async (tx) => {
      const newCorrection = await tx.readingSession.create({
        data: {
          meter_id,
          user_id,
          timestamp,
          reading_date: readingDate,
          is_correction_for_id: originalSessionId,
        },
      });

      const detailData = details.map((d) => ({
        ...d,
        session_id: newCorrection.session_id,
      }));
      await tx.readingDetail.createMany({ data: detailData });

      return tx.readingSession.findUnique({
        where: { session_id: newCorrection.session_id },
        include: { details: true, correction_for: true },
      });
    });
  }

  /**
   * Menghapus sesi pembacaan. Detail akan terhapus otomatis via onDelete: Cascade.
   */
  public async delete(sessionId: number) {
    try {
      // Coba hapus langsung, ini hanya 1x panggilan database
      return await prisma.readingSession.delete({
        where: { session_id: sessionId },
      });
    } catch (error) {
      // Periksa apakah error ini adalah error "data tidak ditemukan" dari Prisma
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // Jika ya, lemparkan error yang lebih deskriptif
        throw new Error404(`Reading session with ID ${sessionId} not found.`);
      }
      // Jika error lain (misal: koneksi db putus), lemparkan error aslinya
      throw error;
    }
  }
}
