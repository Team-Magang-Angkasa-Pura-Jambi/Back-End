import type { PrismaClient } from '@prisma/client';
import { Prisma } from '../generated/prisma/index.js';
import { Error400, Error404, Error409, Error500, HttpError } from './customError.js';

/**
 * Mendefinisikan struktur untuk pesan error kustom yang bisa dikirim
 * dari service spesifik (seperti UserService) ke BaseService.
 */
export interface CustomErrorMessages {
  P2002?: string;
  P2003?: string;
  P2025?: string;
  message?: string;
}

/**
 * Kelas dasar abstrak untuk semua service.
 * Menyediakan metode terpusat untuk penanganan error Prisma yang fleksibel.
 */
export abstract class BaseService {
  protected _prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this._prisma = prisma;
  }
  /**
   * Menerjemahkan error teknis dari Prisma menjadi error bisnis yang lebih jelas.
   * @param error - Error yang ditangkap.
   * @param customMessages - Pesan kustom opsional dari service pemanggil.
   */
  protected _handlePrismaError(error: unknown, customMessages: CustomErrorMessages = {}): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002': {
          throw new Error409(
            customMessages.P2002 ?? 'Data yang Anda masukkan sudah terdaftar di dalam sistem.',
          );
        }
        case 'P2003': {
          const fieldName = error.meta?.field_name as string;
          throw new Error409(
            customMessages.P2003 ??
              `Operasi gagal karena data ini masih terhubung dengan data lain (pada relasi '${fieldName}').`,
          );
        }
        case 'P2025': {
          throw new Error404(
            customMessages.P2025 ?? 'Data yang ingin Anda ubah atau hapus tidak ditemukan.',
          );
        }

        case 'P2000': {
          const columnName = error.meta?.column_name as string;
          throw new Error400(`Nilai yang diberikan untuk kolom '${columnName}' terlalu panjang.`);
        }
        case 'P2011': {
          const constraint = error.meta?.constraint as string;
          throw new Error400(`Kolom wajib '${constraint}' tidak boleh kosong.`);
        }
        default: {
          if (error.message.includes('planLimitReached')) {
            throw new Error500(
              'Batas penggunaan paket Prisma telah tercapai. Silakan periksa dasbor akun Prisma Anda.',
            );
          }
          console.error(`Prisma Error [${error.code}]:`, error.message);
          throw new Error500('Terjadi kesalahan pada operasi database.');
        }
      }
    }

    console.error('Unexpected Error:', error);
    throw new Error500('Terjadi kesalahan tidak terduga pada server.');
  }

  /**
   * Wrapper untuk menjalankan operasi CRUD dan menangani error secara otomatis.
   * @param operation - Sebuah fungsi yang mengembalikan Promise (operasi Prisma Anda).
   * @param customMessages - Pesan kustom opsional untuk error spesifik.
   * @returns Hasil dari operasi jika berhasil.
   */

  protected async _handleCrudOperation<T>(
    operation: () => Promise<T>,
    customMessages?: CustomErrorMessages,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      this._handlePrismaError(error, customMessages);
    }
  }
}
