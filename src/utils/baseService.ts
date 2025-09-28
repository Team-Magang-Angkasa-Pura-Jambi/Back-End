import type { PrismaClient } from '@prisma/client';
import { Prisma } from '../generated/prisma/index.js';
import {
  Error400,
  Error404,
  Error409,
  Error500,
  HttpError,
} from './customError.js';

/**
 * Mendefinisikan struktur untuk pesan error kustom yang bisa dikirim
 * dari service spesifik (seperti UserService) ke BaseService.
 */
export interface CustomErrorMessages {
  P2002?: string; // Data duplikat
  P2003?: string; // Relasi terhubung
  P2025?: string; // Data tidak ditemukan
  // Tambahkan kode error lain di sini jika perlu
}

/**
 * Kelas dasar abstrak untuk semua service.
 * Menyediakan metode terpusat untuk penanganan error Prisma yang fleksibel.
 */
export abstract class BaseService {
  protected _prisma: PrismaClient; // Tambahkan properti ini

  constructor(prisma: PrismaClient) {
    this._prisma = prisma;
  }
  /**
   * Menerjemahkan error teknis dari Prisma menjadi error bisnis yang lebih jelas.
   * @param error - Error yang ditangkap.
   * @param customMessages - Pesan kustom opsional dari service pemanggil.
   */
  protected _handlePrismaError(
    error: unknown,
    customMessages: CustomErrorMessages = {}
  ): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002': {
          const fields = (error.meta?.target as string[])?.join(', ');
          // Gunakan pesan kustom jika ada, jika tidak, gunakan pesan default yang dinamis.
          throw new Error409(
            customMessages.P2002 ||
              `Data dengan nilai yang sama untuk kolom '${fields}' sudah ada.`
          );
        }
        case 'P2003': {
          const fieldName = error.meta?.field_name as string;
          throw new Error409(
            customMessages.P2003 ||
              `Operasi gagal karena data ini masih terhubung dengan data lain (pada relasi '${fieldName}').`
          );
        }
        case 'P2025': {
          throw new Error404(
            customMessages.P2025 ||
              'Data yang ingin Anda ubah atau hapus tidak ditemukan.'
          );
        }
        // [BARU] Menambahkan case error umum lainnya
        case 'P2000': {
          const columnName = error.meta?.column_name as string;
          throw new Error400(
            `Nilai yang diberikan untuk kolom '${columnName}' terlalu panjang.`
          );
        }
        case 'P2011': {
          const constraint = error.meta?.constraint as string;
          throw new Error400(`Kolom wajib '${constraint}' tidak boleh kosong.`);
        }
        default: {
          console.error(`Prisma Error [${error.code}]:`, error.message);
          throw new Error500('Terjadi kesalahan pada operasi database.');
        }
      }
    }

    // Untuk error yang tidak diketahui (bukan dari Prisma)
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
    customMessages?: CustomErrorMessages
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // PERBAIKAN: Cek dulu apakah error ini adalah error kustom kita
      if (error instanceof HttpError) {
        throw error; // Jika ya, lempar kembali apa adanya tanpa diubah
      }

      // Jika bukan, baru serahkan ke handler Prisma untuk diterjemahkan
      this._handlePrismaError(error, customMessages);
    }
  }
}
