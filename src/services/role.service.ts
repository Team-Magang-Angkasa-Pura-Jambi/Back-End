import prisma from '../configs/db.js';
import { Prisma } from '../generated/prisma/index.js';
import type { CreateRoleInput, UpdateRoleInput } from '../types/role.type.js';
import { BaseService } from '../utils/baseService.js';
import { Error409 } from '../utils/customError.js';

/**
 * Service yang menangani semua logika bisnis terkait Peran Pengguna.
 */
export class RoleService extends BaseService {
  /**
   * Menemukan semua peran yang ada.
   */
  public async findAll() {
    return this._handleCrudOperation(() =>
      prisma.role.findMany({
        orderBy: {
          role_id: 'asc',
        },
      })
    );
  }

  /**
   * Menemukan satu peran berdasarkan ID-nya.
   */
  public async findById(roleId: number) {
    return this._handleCrudOperation(() =>
      prisma.role.findUnique({
        where: {
          role_id: roleId,
        },
      })
    );
  }

  /**
   * Membuat peran baru.
   * PERHATIAN: Karena role_name adalah enum yang unik, operasi ini hanya akan berhasil
   * jika nilai enum tersebut belum ada di dalam tabel. Biasanya digunakan untuk inisialisasi awal.
   */
  public async create(data: CreateRoleInput) {
    return this._handleCrudOperation(
      () =>
        prisma.role.create({
          data,
        }),
      {
        P2002: `role '${data.role_name}' sudah terdaftar. Silakan gunakan Role lain.`,
      }
    );
  }

  /**
   * Memperbarui data peran yang ada.
   */
  public async update(roleId: number, data: UpdateRoleInput) {
    return this._handleCrudOperation(
      () =>
        prisma.role.update({
          where: {
            role_id: roleId,
          },
          data,
        }),
      { P2002: `Peran dengan nama '${data.role_name}' sudah digunakan.` }
    );
  }

  /**
   * Menghapus peran.
   * Ini akan gagal jika peran masih terhubung dengan pengguna.
   */
  public async delete(roleId: number) {
    return this._handleCrudOperation(
      () =>
        prisma.role.delete({
          where: {
            role_id: roleId,
          },
        }),
      {
        P2003:
          'Tidak dapat menghapus peran karena masih digunakan oleh pengguna.',
      }
    );
  }
}
export const roleService = new RoleService();
