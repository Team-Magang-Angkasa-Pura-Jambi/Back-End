import prisma from '../configs/db.js';
import { Prisma } from '../generated/prisma/index.js';
import type { CreateRoleInput, UpdateRoleInput } from '../types/role.type.js';
import { Error409 } from '../utils/customError.js';

/**
 * Service yang menangani semua logika bisnis terkait Peran Pengguna.
 */
export class RoleService {
  /**
   * Menemukan semua peran yang ada.
   */
  public async findAll() {
    return prisma.role.findMany({
      orderBy: {
        role_id: 'asc',
      },
    });
  }

  /**
   * Menemukan satu peran berdasarkan ID-nya.
   */
  public async findById(roleId: number) {
    return prisma.role.findUnique({
      where: {
        role_id: roleId,
      },
    });
  }

  /**
   * Membuat peran baru.
   * PERHATIAN: Karena role_name adalah enum yang unik, operasi ini hanya akan berhasil
   * jika nilai enum tersebut belum ada di dalam tabel. Biasanya digunakan untuk inisialisasi awal.
   */
  public async create(data: CreateRoleInput) {
    try {
      return await prisma.role.create({
        data,
      });
    } catch (error) {
      // Menangani error jika peran sudah ada (pelanggaran constraint unik)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new Error409(`Peran dengan nama '${data.role_name}' sudah ada.`);
      }
      throw error;
    }
  }

  /**
   * Memperbarui data peran yang ada.
   */
  public async update(roleId: number, data: UpdateRoleInput) {
    try {
      return await prisma.role.update({
        where: {
          role_id: roleId,
        },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new Error409(
          `Peran dengan nama '${data.role_name}' sudah digunakan.`
        );
      }
      throw error;
    }
  }

  /**
   * Menghapus peran.
   * Ini akan gagal jika peran masih terhubung dengan pengguna.
   */
  public async delete(roleId: number) {
    try {
      return await prisma.role.delete({
        where: {
          role_id: roleId,
        },
      });
    } catch (error) {
      // Menangani error jika peran masih digunakan oleh pengguna
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003' // Foreign key constraint failed
      ) {
        throw new Error409(
          'Tidak dapat menghapus peran karena masih digunakan oleh pengguna.'
        );
      }
      throw error;
    }
  }
}
export const roleService = new RoleService();
